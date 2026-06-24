import { supabase } from "../lib/supabase.js";
import type { Business, Review } from "../types.js";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

const POSITIVE_WORDS = new Set([
  "great", "excellent", "amazing", "awesome", "fantastic", "wonderful", "love", "loved",
  "best", "perfect", "outstanding", "brilliant", "superb", "incredible", "exceptional",
  "happy", "pleased", "satisfied", "recommend", "recommended", "helpful", "friendly",
  "professional", "clean", "quick", "fast", "efficient", "quality", "good", "nice",
]);

const NEGATIVE_WORDS = new Set([
  "terrible", "horrible", "awful", "bad", "worst", "poor", "disappointing", "disappointed",
  "rude", "slow", "dirty", "broken", "waste", "never", "avoid", "disgusting",
  "unprofessional", "incompetent", "useless", "scam", "fraud", "overpriced", "wrong",
  "failed", "problem", "issue", "complaint", "unacceptable", "mediocre",
]);

function scoreText(text: string): "positive" | "negative" | "neutral" {
  const words = text.toLowerCase().replace(/[^a-z\s]/g, " ").split(/\s+/);
  let pos = 0;
  let neg = 0;
  for (const word of words) {
    if (POSITIVE_WORDS.has(word)) pos++;
    if (NEGATIVE_WORDS.has(word)) neg++;
  }
  if (pos === 0 && neg === 0) return "neutral";
  return pos > neg ? "positive" : neg > pos ? "negative" : "neutral";
}

/** Captures a 30-day rolling avg-rating/review-count snapshot for a business,
 * augmented with text-based NLP sentiment scoring on review body text. */
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

  const allReviews = (reviews ?? []) as Review[];
  const rated = allReviews.filter((r) => r.rating !== null);
  const reviewCount = rated.length;
  if (reviewCount === 0) return;

  const avgRating = rated.reduce((sum, r) => sum + (r.rating ?? 0), 0) / reviewCount;

  const withText = allReviews.filter((r) => r.text && r.text.trim().length > 0);
  const sentimentCounts = { positive: 0, negative: 0, neutral: 0 };
  for (const r of withText) {
    sentimentCounts[scoreText(r.text!)]++;
  }
  const totalTexted = withText.length;
  const nlpPositivePct = totalTexted > 0 ? Math.round((sentimentCounts.positive / totalTexted) * 100) : null;

  const { error: insertError } = await supabase.from("sentiment_trend").insert({
    business_id: business.id,
    avg_rating: avgRating,
    review_count: reviewCount,
    period_start: periodStart.toISOString(),
    period_end: periodEnd.toISOString(),
    nlp_positive_pct: nlpPositivePct,
  });
  if (insertError) throw insertError;
}
