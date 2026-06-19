import type { Business, ContentItem } from "../types.js";

/**
 * Foursquare is a directory/venue-listing platform, not a feed-posting
 * platform — "posting" here means pushing a tip/update to the business's
 * venue page via the Foursquare for Business API.
 */
const FOURSQUARE_API_BASE = "https://api.foursquare.com/v2/venues";

export interface FoursquarePostResult {
  platformPostId: string;
}

export async function postToFoursquare(business: Business, item: ContentItem): Promise<FoursquarePostResult> {
  if (!business.foursquare_venue_id || !business.foursquare_access_token) {
    throw new Error(`Business ${business.id} is not connected to Foursquare`);
  }

  const res = await fetch(`${FOURSQUARE_API_BASE}/${business.foursquare_venue_id}/tips/add`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${business.foursquare_access_token}`,
    },
    body: JSON.stringify({ text: item.caption, ...(item.media_url ? { photo: item.media_url } : {}) }),
  });

  if (!res.ok) {
    throw new Error(`Foursquare post failed for business ${business.id}: ${res.status}`);
  }

  const data = (await res.json()) as { response?: { tip?: { id?: string } } };
  const id = data.response?.tip?.id;
  if (!id) throw new Error(`Foursquare post returned no tip id for business ${business.id}`);
  return { platformPostId: id };
}

interface FoursquareInsight {
  views: number;
  clicks: number;
  engagement: number;
}

/** Foursquare has no meaningful per-post insight concept for venue tips —
 * returns zeros, same as the directory platforms in src/distribution. */
export async function fetchFoursquareInsights(_business: Business, _platformPostId: string): Promise<FoursquareInsight> {
  return { views: 0, clicks: 0, engagement: 0 };
}
