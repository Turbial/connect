import { supabase } from "../lib/supabase.js";
import type { Business, Review } from "../types.js";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/** Captures a 30-day rolling avg-rating/review-count snapshot for a business. */
export async function captureSentimentTrend(business: Business): Promise<void> {
  const periodEnd = new Date();
  const periodStart = new Date(periodEnd.getTime() - THIRTY_DAYS_MS);

  const { data: reviews, error } = await supabase
    .from("review")
    .select("*")
    .eq("business_id", business.id)
    .gte("received_at", periodStart.toISOString())
    .lte("received_at", periodEnd.toISOString());
  if (error) throw error;

  const rated = ((reviews ?? []) as Review[]).filter((r) => r.rating !== null);
  const reviewCount = rated.length;
  if (reviewCount === 0) return;

  const avgRating = rated.reduce((sum, r) => sum + (r.rating ?? 0), 0) / reviewCount;

  const { error: insertError } = await supabase.from("sentiment_trend").insert({
    business_id: business.id,
    avg_rating: avgRating,
    review_count: reviewCount,
    period_start: periodStart.toISOString(),
    period_end: periodEnd.toISOString(),
  });
  if (insertError) throw insertError;
}
