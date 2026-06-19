import { supabase } from "../../lib/supabase.js";
import { captureSignal } from "../shared.js";
import type { Business, Review } from "../../types.js";

/** Captures the share of reviews that have a suggested/sent reply on file,
 * as a proxy for review-response rate. */
export async function runReviewResponseRateSignal(business: Business): Promise<void> {
  const { data: reviews, error } = await supabase.from("review").select("*").eq("business_id", business.id);
  if (error) throw error;

  const all = (reviews ?? []) as Review[];
  if (all.length === 0) {
    await captureSignal(business.id, "review-response-rate", "response_rate", "0");
    return;
  }

  const responded = all.filter((r) => r.suggested_reply !== null).length;
  const rate = responded / all.length;
  await captureSignal(business.id, "review-response-rate", "response_rate", rate.toFixed(2));
}
