import { supabase } from "../lib/supabase.js";
import { queueReviewTriggeredContent } from "../content-engine/index.js";
import { generateReviewReplyDraft } from "../content-engine/generate.js";
import { requestApproval } from "../approval/index.js";
import { sendApprovalMessage } from "../approval/channel.js";
import { classifyComplaintTheme } from "../lib/complaintThemes.js";
import type { Business } from "../types.js";

export interface ReachReviewPayload {
  business_id: string;
  review_id: string;
  rating: number | null;
  text: string | null;
  customer_name: string | null;
}

/** Only positive, substantive reviews are worth turning into content. */
const MIN_RATING_FOR_CONTENT = 4;

/** Reviews at or below this rating get their drafted reply escalated to the
 * owner for action, rather than auto-posting a public reply (Phase 7.6). */
const MAX_RATING_FOR_ESCALATION = 3;

function buildBrief(payload: ReachReviewPayload): string {
  const reviewer = payload.customer_name ? `${payload.customer_name} said` : "A customer said";
  return `${reviewer}: "${payload.text}"`;
}

/** Handles an inbound review event from Reach: stores it, and for positive reviews with text,
 * queues a review-triggered content draft across the business's connected platforms. */
export async function handleReachReview(payload: ReachReviewPayload): Promise<void> {
  const { data: review, error } = await supabase
    .from("review")
    .insert({
      business_id: payload.business_id,
      source: "reach",
      rating: payload.rating,
      text: payload.text,
      customer_name: payload.customer_name,
    })
    .select()
    .single();
  if (error) throw error;

  // Phase 9.3: classify negative reviews into a fixed complaint theme,
  // best-effort — a failed/unavailable classification just leaves the
  // review unthemed, it never blocks the reply-draft/escalation flow below.
  const complaintTheme = await classifyComplaintTheme(payload.rating, payload.text);
  if (complaintTheme) {
    const { error: themeError } = await supabase.from("review").update({ complaint_theme: complaintTheme }).eq("id", review.id);
    if (themeError) throw themeError;
  }

  const { data: business, error: businessError } = await supabase
    .from("business")
    .select("*")
    .eq("id", payload.business_id)
    .single();
  if (businessError) throw businessError;

  if (payload.text) {
    const suggestedReply = await generateReviewReplyDraft(business as Business, payload);
    if (suggestedReply) {
      const { error: replyError } = await supabase.from("review").update({ suggested_reply: suggestedReply }).eq("id", review.id);
      if (replyError) throw replyError;

      // Negative-review path: escalate the drafted response to the owner via
      // the approval channel for action — this is response-drafting only,
      // never an automatic public reply.
      if ((payload.rating ?? 0) <= MAX_RATING_FOR_ESCALATION) {
        const ownerBusiness = business as Business;
        if (ownerBusiness.owner_phone || ownerBusiness.owner_email || ownerBusiness.owner_mobile) {
          const reviewer = payload.customer_name ?? "a customer";
          await sendApprovalMessage(
            ownerBusiness,
            "A review needs your response",
            `${reviewer} left a ${payload.rating ?? "?"}-star review: "${payload.text}". Suggested reply: "${suggestedReply}". Reply YES to send it, or EDIT to revise.`
          );
        }
      }
    }
  }

  if (!payload.text || (payload.rating ?? 0) < MIN_RATING_FOR_CONTENT) return;

  // Positive-review path: generate a quote-card content item and immediately
  // route it through the existing owner approval flow rather than posting it
  // unreviewed or leaving it to wait for the next weekly batch.
  const items = await queueReviewTriggeredContent(business as Business, review.id, buildBrief(payload), payload.rating);
  if (items.length > 0) await requestApproval(business as Business, items);
}
