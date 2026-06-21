import { supabase } from "../lib/supabase.js";
import { getLatestVisibilityScore } from "../visibility-score/index.js";
import type { Business, Competitor, CompetitorSnapshot } from "../types.js";

/**
 * Tracks named competitors per business via the Google Places API (New)
 * Place Details endpoint, capturing rating/review-count snapshots over time
 * so the owner can see how their own visibility metrics compare.
 */
const PLACES_DETAILS_URL = (placeId: string) => `https://places.googleapis.com/v1/places/${placeId}`;

export async function addCompetitor(business: Business, name: string, gbpPlaceId?: string): Promise<Competitor> {
  const { data, error } = await supabase
    .from("competitor")
    .insert({ business_id: business.id, name, gbp_place_id: gbpPlaceId ?? null })
    .select()
    .single();
  if (error) throw error;
  return data as Competitor;
}

async function fetchPlaceSnapshot(placeId: string): Promise<{ rating: number | null; reviewCount: number | null }> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return { rating: null, reviewCount: null };

  const res = await fetch(PLACES_DETAILS_URL(placeId), {
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "rating,userRatingCount",
    },
  });
  if (!res.ok) throw new Error(`Places API request failed for ${placeId}: ${res.status}`);

  const data = (await res.json()) as { rating?: number; userRatingCount?: number };
  return { rating: data.rating ?? null, reviewCount: data.userRatingCount ?? null };
}

/** Captures a rating/review-count snapshot for every tracked competitor of a business. */
export async function captureCompetitorSnapshots(business: Business): Promise<void> {
  const { data: competitors, error } = await supabase
    .from("competitor")
    .select("*")
    .eq("business_id", business.id);
  if (error) throw error;

  for (const competitor of (competitors ?? []) as Competitor[]) {
    if (!competitor.gbp_place_id) continue;

    const snapshot = await fetchPlaceSnapshot(competitor.gbp_place_id);
    const { error: insertError } = await supabase.from("competitor_snapshot").insert({
      competitor_id: competitor.id,
      rating: snapshot.rating,
      review_count: snapshot.reviewCount,
    });
    if (insertError) throw insertError;
  }
}

export interface CompetitorWithLatestSnapshot extends Competitor {
  latestSnapshot: Pick<CompetitorSnapshot, "rating" | "review_count" | "captured_at"> | null;
}

/** Every tracked competitor for a business alongside its most recent
 * snapshot, so the owner can see who's being tracked and how they compare
 * without separately querying competitor + competitor_snapshot. */
export async function getTrackedCompetitors(businessId: string): Promise<CompetitorWithLatestSnapshot[]> {
  const { data: competitors, error } = await supabase
    .from("competitor")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: true });
  if (error) throw error;

  const results: CompetitorWithLatestSnapshot[] = [];
  for (const competitor of (competitors ?? []) as Competitor[]) {
    const { data: snapshots, error: snapshotError } = await supabase
      .from("competitor_snapshot")
      .select("rating, review_count, captured_at")
      .eq("competitor_id", competitor.id)
      .order("captured_at", { ascending: false })
      .limit(1);
    if (snapshotError) throw snapshotError;
    results.push({ ...competitor, latestSnapshot: snapshots?.[0] ?? null });
  }
  return results;
}

export interface CompetitorComparison {
  ownVisibilityScore: number | null;
  ownAvgRating: number | null;
  competitors: { name: string; rating: number | null; reviewCount: number | null }[];
}

/** Puts the business's own visibility score and average review rating
 * side-by-side with each tracked competitor's latest snapshot, so the owner
 * can see at a glance how they stack up rather than reading two separate
 * cards. */
export async function getCompetitorComparison(business: Business): Promise<CompetitorComparison> {
  const [visibilityScore, sentiment, competitors] = await Promise.all([
    getLatestVisibilityScore(business.id),
    supabase
      .from("sentiment_trend")
      .select("avg_rating")
      .eq("business_id", business.id)
      .order("period_end", { ascending: false })
      .limit(1),
    getTrackedCompetitors(business.id),
  ]);
  if (sentiment.error) throw sentiment.error;

  return {
    ownVisibilityScore: visibilityScore?.score ?? null,
    ownAvgRating: (sentiment.data?.[0] as { avg_rating: number } | undefined)?.avg_rating ?? null,
    competitors: competitors.map((c) => ({
      name: c.name,
      rating: c.latestSnapshot?.rating ?? null,
      reviewCount: c.latestSnapshot?.review_count ?? null,
    })),
  };
}
