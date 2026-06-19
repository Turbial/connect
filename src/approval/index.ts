import { supabase } from "../lib/supabase.js";
import { sendApprovalSms, parseReply } from "./sms.js";
import { sendApprovalEmail } from "./email.js";
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

/** Applies each request's configured timeout action to requests that never got a reply. */
export async function applyTimeouts(timeoutHours: number): Promise<void> {
  const cutoff = new Date(Date.now() - timeoutHours * 60 * 60 * 1000).toISOString();

  const { data: expired, error } = await supabase
    .from("approval_request")
    .select("id, content_item_id, timeout_action")
    .is("responded_at", null)
    .lt("sent_at", cutoff);
  if (error) throw error;

  for (const request of expired ?? []) {
    const status = request.timeout_action === "auto_post" ? "approved" : "rejected";
    await supabase.from("content_item").update({ status }).eq("id", request.content_item_id);
    await supabase
      .from("approval_request")
      .update({ response: "(timeout)", responded_at: new Date().toISOString() })
      .eq("id", request.id);
  }
}
