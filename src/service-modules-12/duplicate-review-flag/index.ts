import { supabase } from "../../lib/supabase.js";
import { captureSignal } from "../shared.js";
import type { Business, Review } from "../../types.js";

/** Flags whether the business has near-duplicate review text on file
 * (possible spam/fake-review signal), via a simple exact-text match — a
 * true fuzzy/duplicate-detection pass would need a similarity scorer, kept
 * simple here per Phase 12's scope. */
export async function runDuplicateReviewFlagSignal(business: Business): Promise<void> {
  const { data: reviews, error } = await supabase.from("review").select("*").eq("business_id", business.id);
  if (error) throw error;

  const texts = ((reviews ?? []) as Review[]).map((r) => r.text).filter((t): t is string => Boolean(t));
  const hasDuplicate = texts.length !== new Set(texts).size;
  await captureSignal(business.id, "duplicate-review-flag", "duplicate_review_detected", String(hasDuplicate));
}
