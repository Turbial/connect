import type { Business, ContentItem } from "../types.js";

/**
 * Bing Places for Business is a directory-listing platform with no public
 * feed/post concept — "posting" here updates the business's listing
 * description/highlight via the Bing Places API.
 */
const BING_PLACES_API_BASE = "https://www.bingapis.com/api/v7/businesses";

export interface BingPostResult {
  platformPostId: string;
}

export async function postToBing(business: Business, item: ContentItem): Promise<BingPostResult> {
  if (!business.bing_business_id || !business.bing_access_token) {
    throw new Error(`Business ${business.id} is not connected to Bing Places`);
  }

  const res = await fetch(`${BING_PLACES_API_BASE}/${business.bing_business_id}/updates`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${business.bing_access_token}`,
    },
    body: JSON.stringify({ description: item.caption, ...(item.media_url ? { photoUrl: item.media_url } : {}) }),
  });

  if (!res.ok) {
    throw new Error(`Bing Places post failed for business ${business.id}: ${res.status}`);
  }

  const data = (await res.json()) as { updateId?: string };
  if (!data.updateId) throw new Error(`Bing Places post returned no update id for business ${business.id}`);
  return { platformPostId: data.updateId };
}

interface BingInsight {
  views: number;
  clicks: number;
  engagement: number;
}

/** Bing Places is a directory platform — no post-level analytics exist;
 * returns zeros. */
export async function fetchBingInsights(_business: Business, _platformPostId: string): Promise<BingInsight> {
  return { views: 0, clicks: 0, engagement: 0 };
}
