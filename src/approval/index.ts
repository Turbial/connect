import { supabase } from "../lib/supabase.js";
import { sendApprovalSms, parseReply } from "./sms.js";
import { sendApprovalEmail } from "./email.js";
import { sendApprovalMessage } from "./channel.js";
import { callDeepSeekPrompt } from "../content-engine/generate.js";
import { getOrganizationForBusiness, orgDisplayName, resolveBusinessSetting } from "../lib/orgSettings.js";
import type { ApprovalChainStep, Business, ContentItem, Organization } from "../types.js";

function buildMessage(business: Business, items: ContentItem[], displayName: string): string {
  const lines = items.map((item, i) => `${i + 1}. "${item.caption.slice(0, 100)}"`);
  return [
    `Your weekly ${displayName} posts are ready for ${business.name}:`,
    ...lines,
    "Reply YES to post all, NO to skip this week, or EDIT to make changes.",
  ].join("\n");
}

/** Phase 4.2: ordered approval chain for an org, empty when no chain is
 * configured — callers fall back to the existing single-owner flow. */
async function getChainSteps(organizationId: string): Promise<ApprovalChainStep[]> {
  const { data, error } = await supabase
    .from("approval_chain_step")
    .select("*")
    .eq("organization_id", organizationId)
    .order("step_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ApprovalChainStep[];
}

/** Sends a chain step's approval request via its phone/email, in addition to
 * the business owner (kept for traceability — the owner stays in the loop
 * even once brand/regional approval is required, rather than being dropped
 * from the conversation). */
async function sendToStep(step: ApprovalChainStep, message: string, organization: Organization | null): Promise<void> {
  if (step.phone) {
    await sendApprovalSms(step.phone, message, organization?.twilio_from_number ?? null);
  } else if (step.email) {
    await sendApprovalEmail(step.email, "Approval needed", message);
  }
}

/** Sends the weekly approval request for a business's queued content items.
 * Phase 4.2: an org's emergency content pause skips the business entirely
 * (no-op, not an error) so a paused brand doesn't keep nagging an owner.
 * Phase 4.2: when the business's org has a configured approval chain, the
 * request also goes to the first step's phone/email (additionally, not
 * instead of, the owner — see sendToStep) and chain_step_index is set to 0
 * so handleSmsReply knows to walk the chain instead of finalizing on the
 * owner's reply alone. */
export async function requestApproval(business: Business, items: ContentItem[]): Promise<void> {
  if (items.length === 0) return;

  const organization = await getOrganizationForBusiness(business);
  if (organization?.content_paused) return;

  const displayName = orgDisplayName(organization);
  const message = buildMessage(business, items, displayName);

  const channel = business.owner_preferred_channel === "whatsapp" ? "whatsapp" : business.owner_phone ? "sms" : "email";
  await sendApprovalMessage(business, `Your ${displayName} posts are ready`, message);

  const chainSteps = organization ? await getChainSteps(organization.id) : [];
  const firstStep = chainSteps[0];
  if (firstStep) await sendToStep(firstStep, message, organization);

  for (const item of items) {
    const { error } = await supabase.from("approval_request").insert({
      content_item_id: item.id,
      channel,
      timeout_action: "hold",
      chain_step_index: firstStep ? 0 : null,
    });
    if (error) throw error;
  }
}

/** Finalizes approval (matching today's full-approval path) for all queued
 * content items belonging to this business. */
async function finalizeApproval(businessId: string, body: string, queuedItemIds: string[]): Promise<void> {
  for (const itemId of queuedItemIds) {
    await supabase.from("content_item").update({ status: "approved" }).eq("id", itemId);
    await supabase
      .from("approval_request")
      .update({ response: body, responded_at: new Date().toISOString() })
      .eq("content_item_id", itemId)
      .is("responded_at", null);
  }
}

/** Phase 4.2: advances a chain to the next step (sending that step the
 * approval request and bumping chain_step_index), or finalizes approval if
 * the step that just replied YES was the last one in the chain. */
async function advanceChain(
  business: Business,
  organization: Organization,
  body: string,
  queuedItemIds: string[]
): Promise<void> {
  const { data: pendingRequests, error } = await supabase
    .from("approval_request")
    .select("id, chain_step_index")
    .in("content_item_id", queuedItemIds)
    .is("responded_at", null);
  if (error) throw error;

  const currentIndex = (pendingRequests ?? [])[0]?.chain_step_index as number | null | undefined;
  if (currentIndex === null || currentIndex === undefined) {
    await finalizeApproval(business.id, body, queuedItemIds);
    return;
  }

  const steps = await getChainSteps(organization.id);
  const nextIndex = currentIndex + 1;
  const nextStep = steps[nextIndex];

  if (!nextStep) {
    await finalizeApproval(business.id, body, queuedItemIds);
    return;
  }

  const { data: items } = await supabase.from("content_item").select("caption").in("id", queuedItemIds);
  const message = buildMessage(
    business,
    (items ?? []).map((i) => ({ caption: i.caption }) as ContentItem),
    orgDisplayName(organization)
  );
  await sendToStep(nextStep, message, organization);

  for (const requestId of (pendingRequests ?? []).map((r) => r.id)) {
    await supabase.from("approval_request").update({ chain_step_index: nextIndex }).eq("id", requestId);
  }
}

/** Handles an inbound SMS reply, updating all pending content items for that business.
 * Phase 4.2: when the business's org has a configured chain and the reply is
 * a YES, the chain advances to the next step (or finalizes after the last
 * step) instead of resolving immediately — NO/EDIT still resolve immediately
 * as rejection/edit, matching today's semantics unchanged. */
export async function handleSmsReply(businessId: string, body: string): Promise<void> {
  const decision = parseReply(body);

  const { data: queuedItems, error: queryError } = await supabase
    .from("content_item")
    .select("id, business_id")
    .eq("business_id", businessId)
    .eq("status", "queued");
  if (queryError) throw queryError;
  const queuedItemIds = (queuedItems ?? []).map((i) => i.id);
  if (queuedItemIds.length === 0) return;

  if (decision === "approve") {
    const { data: business, error: businessError } = await supabase.from("business").select("*").eq("id", businessId).single();
    if (businessError) throw businessError;
    const organization = await getOrganizationForBusiness(business as Business);

    if (organization) {
      const steps = await getChainSteps(organization.id);
      if (steps.length > 0) {
        await advanceChain(business as Business, organization, body, queuedItemIds);
        return;
      }
    }
    await finalizeApproval(businessId, body, queuedItemIds);
    return;
  }

  const newStatus = decision === "reject" ? "rejected" : "edited";
  for (const itemId of queuedItemIds) {
    await supabase.from("content_item").update({ status: newStatus }).eq("id", itemId);
    await supabase
      .from("approval_request")
      .update({ response: body, responded_at: new Date().toISOString() })
      .eq("content_item_id", itemId)
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

  if (!business.owner_phone && !business.owner_email && !business.owner_mobile) return;
  await sendApprovalMessage(business, "Revised post ready for review", message);

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
    .select("id, approval_timeout_hours, organization_id")
    .in("id", businessIds.length > 0 ? businessIds : ["00000000-0000-0000-0000-000000000000"]);
  if (businessesError) throw businessesError;

  // Phase 4.1: resolve the org-level approval_timeout_hours default for
  // businesses with no business-level override, before falling back to
  // defaultTimeoutHours.
  const organizationIds = [...new Set((businesses ?? []).map((b) => b.organization_id as string | null).filter((id): id is string => !!id))];
  const { data: organizations, error: organizationsError } =
    organizationIds.length > 0
      ? await supabase.from("organization").select("id, approval_timeout_hours").in("id", organizationIds)
      : { data: [], error: null };
  if (organizationsError) throw organizationsError;
  const timeoutHoursByOrganization = new Map((organizations ?? []).map((o) => [o.id as string, o.approval_timeout_hours as number | null]));

  const timeoutHoursByBusiness = new Map(
    (businesses ?? []).map((b) => {
      const orgId = b.organization_id as string | null;
      const orgDefault = orgId ? timeoutHoursByOrganization.get(orgId) : null;
      return [b.id as string, (b.approval_timeout_hours as number | null) ?? orgDefault ?? defaultTimeoutHours];
    })
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
