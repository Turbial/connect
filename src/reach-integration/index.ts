import { supabase } from "../lib/supabase.js";
import { queueReviewTriggeredContent } from "../content-engine/index.js";
import { generateReviewReplyDraft } from "../content-engine/generate.js";
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
    }
  }

  if (!payload.text || (payload.rating ?? 0) < MIN_RATING_FOR_CONTENT) return;

  await queueReviewTriggeredContent(business as Business, review.id, buildBrief(payload), payload.rating);
}
