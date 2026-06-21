import { supabase } from "../lib/supabase.js";
import type { Business } from "../types.js";

/**
 * Local keyword rank tracking via the Google Places API (New) Text Search
 * endpoint — searches the same query a customer would, then finds the
 * business's own listing in the result order to derive its rank.
 */
const PLACES_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";

function matchesBusiness(business: Business, place: { id?: string; displayName?: { text?: string } }): boolean {
  if (business.gbp_location_id && place.id) {
    return place.id === business.gbp_location_id || place.id.includes(business.gbp_location_id);
  }
  return place.displayName?.text?.toLowerCase() === business.name.toLowerCase();
}

/** Tracks a business's local search rank for a given keyword and stores a snapshot. */
export async function trackRank(business: Business, keyword: string): Promise<{ rank: number | null }> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return { rank: null };

  const res = await fetch(PLACES_SEARCH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.id,places.displayName",
    },
    body: JSON.stringify({ textQuery: `${keyword} near ${business.location}` }),
  });
  if (!res.ok) throw new Error(`Places API search failed for business ${business.id}: ${res.status}`);

  const data = (await res.json()) as { places?: { id?: string; displayName?: { text?: string } }[] };
  const places = data.places ?? [];
  const index = places.findIndex((place) => matchesBusiness(business, place));
  const rank = index === -1 ? null : index + 1;

  const { error } = await supabase.from("rank_snapshot").insert({
    business_id: business.id,
    keyword,
    rank,
  });
  if (error) throw error;

  return { rank };
}
