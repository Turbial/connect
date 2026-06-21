import { supabase } from "../../lib/supabase.js";
import { captureSignal } from "../shared.js";
import type { Business, Review } from "../../types.js";

/** Captures whether the business has enough positive reviews to justify
 * displaying a social-proof badge (e.g. "4.8 stars, 50+ reviews") on its
 * own listings/site. */
export async function runSocialProofBadgeCheck(business: Business): Promise<void> {
  const { data: reviews, error } = await supabase.from("review").select("*").eq("business_id", business.id);
  if (error) throw error;

  const rated = ((reviews ?? []) as Review[]).filter((r) => r.rating !== null);
  const eligible = rated.length >= 10 && rated.reduce((sum, r) => sum + (r.rating ?? 0), 0) / rated.length >= 4;
  await captureSignal(business.id, "social-proof-badge", "badge_eligible", String(eligible));
}
