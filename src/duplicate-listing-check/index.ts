import { supabase } from "../lib/supabase.js";
import type { Business } from "../types.js";

/**
 * Flags potential duplicate Google Business Profile listings by running the
 * same Text Search a customer would for the business's name and surfacing
 * any result that isn't the business's own confirmed listing.
 */
const PLACES_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";

function isOwnListing(business: Business, place: { id?: string }): boolean {
  if (!business.gbp_location_id || !place.id) return false;
  return place.id === business.gbp_location_id || place.id.includes(business.gbp_location_id);
}

/** Searches for duplicate/competing listings of a business's own name and stores flags. */
export async function checkDuplicateListings(business: Business): Promise<void> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return;

  const res = await fetch(PLACES_SEARCH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress",
    },
    body: JSON.stringify({ textQuery: `${business.name} near ${business.location}` }),
  });
  if (!res.ok) throw new Error(`Places API search failed for business ${business.id}: ${res.status}`);

  const data = (await res.json()) as {
    places?: { id?: string; displayName?: { text?: string }; formattedAddress?: string }[];
  };

  for (const place of data.places ?? []) {
    if (!place.id || isOwnListing(business, place)) continue;

    const { error } = await supabase.from("duplicate_listing_flag").insert({
      business_id: business.id,
      candidate_place_id: place.id,
      candidate_name: place.displayName?.text ?? "Unknown",
      candidate_address: place.formattedAddress ?? null,
    });
    if (error) throw error;
  }
}
