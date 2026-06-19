import { supabase } from "../lib/supabase.js";
import { sendApprovalSms, parseReply } from "./sms.js";
import { sendApprovalEmail } from "./email.js";
import { callDeepSeekPrompt } from "../content-engine/generate.js";
import type { Business, ContentItem } from "../types.js";

function buildMessage(business: Business, items: ContentItem[]): string {
  const lines = items.map((item, i) => `${i + 1}. "${item.caption.slice(0, 100)}"`);
  return [
    `Your weekly posts are ready for ${business.name}:`,
    ...lines,
    "Reply YES to post all, NO to skip this week, or EDIT to make changes.",
  ].join("\n");
}

/** Sends the weekly approval request for a business's queued content items. */
export async function requestApproval(business: Business, items: ContentItem[]): Promise<void> {
  if (items.length === 0) return;
  const message = buildMessage(business, items);

  const channel = business.owner_phone ? "sms" : "email";
  if (channel === "sms") {
    await sendApprovalSms(business.owner_phone!, message);
  } else if (business.owner_email) {
    await sendApprovalEmail(business.owner_email, "Your MightyMax posts are ready", message);
  } else {
    throw new Error(`Business ${business.id} has no owner_phone or owner_email`);
  }

  for (const item of items) {
    const { error } = await supabase.from("approval_request").insert({
      content_item_id: item.id,
      channel,
      timeout_action: "hold",
    });
    if (error) throw error;
  }
}

/** Handles an inbound SMS reply, updating all pending content items for that business. */
export async function handleSmsReply(businessId: string, body: string): Promise<void> {
  const decision = parseReply(body);

  const { data: queuedItems, error: queryError } = await supabase
    .from("content_item")
    .select("id")
    .eq("business_id", businessId)
    .eq("status", "queued");
  if (queryError) throw queryError;

  const newStatus = decision === "approve" ? "approved" : decision === "reject" ? "rejected" : "edited";

  for (const item of queuedItems ?? []) {
    await supabase.from("content_item").update({ status: newStatus }).eq("id", item.id);
    await supabase
      .from("approval_request")
      .update({ response: body, responded_at: new Date().toISOString() })
      .eq("content_item_id", item.id)
      .is("responded_at", null);
  }
}

export interface EditQueueItem {
  contentItemId: string;
  businessId: string;
  caption: string;
  requestedChange: string | null;
}

/** Content items an owner replied EDIT to, paired with what they asked for
 * (the raw reply text), so an EDIT never just disappears into the database
 * with no concrete next action. */
export async function getEditQueue(): Promise<EditQueueItem[]> {
  const { data: items, error } = await supabase
    .from("content_item")
    .select("id, business_id, caption")
    .eq("status", "edited");
  if (error) throw error;

  const queue: EditQueueItem[] = [];
  for (const item of items ?? []) {
    const { data: request } = await supabase
      .from("approval_request")
      .select("response")
      .eq("content_item_id", item.id)
      .order("responded_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    queue.push({
      contentItemId: item.id,
      businessId: item.business_id,
      caption: item.caption,
      requestedChange: request?.response ?? null,
    });
  }
  return queue;
}

/**
 * Phase 3.3: drafts a revised caption from the original caption + the
 * owner's requested change text, reusing the Content Engine's DeepSeek call
 * rather than a separate LLM integration. Returns null if no DEEPSEEK_API_KEY
 * is configured, matching the existing fallback pattern in generate.ts where
 * missing API keys degrade gracefully instead of throwing.
 */
export async function draftEditRewrite(item: EditQueueItem): Promise<string | null> {
  if (!item.requestedChange) return null;

  return callDeepSeekPrompt(
    `Here is a social media caption: "${item.caption}". The business owner replied with this requested change: "${item.requestedChange}". Rewrite the caption to incorporate the owner's requested change, keeping the same overall tone and length. Respond with only the rewritten caption, no explanation.`
  );
}

/**
 * Sends a drafted rewrite back to the owner for a second YES/NO and stores
 * it on the most recent approval_request row for that content item (rather
 * than overwriting content_item.caption directly) — the rewrite only
 * becomes live once the owner approves it via handleEditRewriteReply below,
 * so it can't silently replace the caption on a flaky/ambiguous EDIT reply.
 */
export async function proposeEditRewrite(business: Business, item: EditQueueItem, rewrite: string): Promise<void> {
  const message = [
    `Here's a revised version for ${business.name}: "${rewrite}"`,
    "Reply YES to use this version, or NO to leave it as-is.",
  ].join(" ");

  if (business.owner_phone) {
    await sendApprovalSms(business.owner_phone, message);
  } else if (business.owner_email) {
    await sendApprovalEmail(business.owner_email, "Revised post ready for review", message);
  } else {
    return;
  }

  const { data: latestRequest, error: lookupError } = await supabase
    .from("approval_request")
    .select("id")
    .eq("content_item_id", item.contentItemId)
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lookupError) throw lookupError;
  if (!latestRequest) return;

  const { error } = await supabase.from("approval_request").update({ proposed_rewrite: rewrite }).eq("id", latestRequest.id);
  if (error) throw error;
}

/**
 * Handles the owner's second YES/NO reply to a proposed rewrite: YES
 * overwrites content_item.caption with the proposed_rewrite and re-queues it
 * for approval/posting; NO leaves the original caption in place. Looks up
 * the most recent approval_request with a proposed_rewrite still pending a
 * decision for this business's edited content items.
 */
export async function handleEditRewriteReply(businessId: string, body: string): Promise<boolean> {
  const decision = parseReply(body);
  if (decision !== "approve" && decision !== "reject") return false;

  const { data: editedItems, error: itemsError } = await supabase
    .from("content_item")
    .select("id")
    .eq("business_id", businessId)
    .eq("status", "edited");
  if (itemsError) throw itemsError;
  const editedItemIds = (editedItems ?? []).map((i) => i.id);
  if (editedItemIds.length === 0) return false;

  const { data: pending, error: pendingError } = await supabase
    .from("approval_request")
    .select("*")
    .in("content_item_id", editedItemIds)
    .not("proposed_rewrite", "is", null)
    .order("sent_at", { ascending: false })
    .limit(1);
  if (pendingError) throw pendingError;

  const request = (pending ?? [])[0];
  if (!request) return false;

  if (decision === "approve") {
    const { error } = await supabase
      .from("content_item")
      .update({ caption: request.proposed_rewrite, status: "queued" })
      .eq("id", request.content_item_id);
    if (error) throw error;
  }

  await supabase.from("approval_request").update({ proposed_rewrite: null }).eq("id", request.id);
  return true;
}

/** Applies each request's configured timeout action to requests that never got a reply.
 * defaultTimeoutHours applies to businesses without their own approval_timeout_hours
 * override (Phase 2.4 adaptability setting); each request's content_item -> business_id
 * is looked up to resolve the per-business override, since approval_request itself
 * has no business_id column to join on directly. */
export async function applyTimeouts(defaultTimeoutHours: number): Promise<void> {
  const { data: pending, error } = await supabase
    .from("approval_request")
    .select("id, content_item_id, timeout_action, sent_at")
    .is("responded_at", null);
  if (error) throw error;
  if (!pending || pending.length === 0) return;

  const contentItemIds = [...new Set(pending.map((r) => r.content_item_id))];
  const { data: items, error: itemsError } = await supabase
    .from("content_item")
    .select("id, business_id")
    .in("id", contentItemIds);
  if (itemsError) throw itemsError;

  const businessIdByItem = new Map((items ?? []).map((i) => [i.id, i.business_id as string]));
  const businessIds = [...new Set((items ?? []).map((i) => i.business_id as string))];

  const { data: businesses, error: businessesError } = await supabase
    .from("business")
    .select("id, approval_timeout_hours")
    .in("id", businessIds.length > 0 ? businessIds : ["00000000-0000-0000-0000-000000000000"]);
  if (businessesError) throw businessesError;

  const timeoutHoursByBusiness = new Map(
    (businesses ?? []).map((b) => [b.id as string, (b.approval_timeout_hours as number | null) ?? defaultTimeoutHours])
  );

  for (const request of pending) {
    const businessId = businessIdByItem.get(request.content_item_id);
    const timeoutHours = (businessId ? timeoutHoursByBusiness.get(businessId) : undefined) ?? defaultTimeoutHours;
    const cutoff = new Date(Date.now() - timeoutHours * 60 * 60 * 1000).toISOString();
    if (request.sent_at >= cutoff) continue;

    const status = request.timeout_action === "auto_post" ? "approved" : "rejected";
    await supabase.from("content_item").update({ status }).eq("id", request.content_item_id);
    await supabase
      .from("approval_request")
      .update({ response: "(timeout)", responded_at: new Date().toISOString() })
      .eq("id", request.id);
  }
}
