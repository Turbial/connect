import type { Business, ContentItem } from "../types.js";

/**
 * OpenTable is a reservation/review platform for restaurants — "posting"
 * here updates the restaurant's profile highlight via OpenTable's partner API.
 */
const OPENTABLE_API_BASE = "https://platform.opentable.com/api/v1/restaurants";

export interface OpentablePostResult {
  platformPostId: string;
}

export async function postToOpentable(business: Business, item: ContentItem): Promise<OpentablePostResult> {
  if (!business.opentable_restaurant_id || !business.opentable_access_token) {
    throw new Error(`Business ${business.id} is not connected to OpenTable`);
  }

  const res = await fetch(`${OPENTABLE_API_BASE}/${business.opentable_restaurant_id}/updates`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${business.opentable_access_token}`,
    },
    body: JSON.stringify({ text: item.caption, ...(item.media_url ? { photoUrl: item.media_url } : {}) }),
  });

  if (!res.ok) {
    throw new Error(`OpenTable post failed for business ${business.id}: ${res.status}`);
  }

  const data = (await res.json()) as { id?: string };
  if (!data.id) throw new Error(`OpenTable post returned no id for business ${business.id}`);
  return { platformPostId: data.id };
}

interface OpentableInsight {
  views: number;
  clicks: number;
  engagement: number;
}

/** OpenTable is a reservation/review platform — no post-level analytics
 * exist; returns zeros. */
export async function fetchOpentableInsights(_business: Business, _platformPostId: string): Promise<OpentableInsight> {
  return { views: 0, clicks: 0, engagement: 0 };
}
