import { supabase } from "../lib/supabase.js";
import type { Business, Competitor } from "../types.js";

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
