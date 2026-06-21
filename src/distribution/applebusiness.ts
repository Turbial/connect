import type { Business, ContentItem } from "../types.js";

/**
 * Apple Business Connect is a directory-listing platform — "posting" here
 * pushes a "showcase" update to the business's location via the Apple
 * Business Connect API. Apple's auth model is cert-based (team id/key id)
 * rather than client id/secret, but the resulting bearer token is still
 * stored per-business like every other adapter.
 */
const APPLE_BUSINESS_API_BASE = "https://businessconnect.apple.com/api/v1/locations";

export interface ApplebusinessPostResult {
  platformPostId: string;
}

export async function postToApplebusiness(business: Business, item: ContentItem): Promise<ApplebusinessPostResult> {
  if (!business.applebusiness_location_id || !business.applebusiness_access_token) {
    throw new Error(`Business ${business.id} is not connected to Apple Business Connect`);
  }

  const res = await fetch(`${APPLE_BUSINESS_API_BASE}/${business.applebusiness_location_id}/showcases`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${business.applebusiness_access_token}`,
    },
    body: JSON.stringify({ text: item.caption, ...(item.media_url ? { imageUrl: item.media_url } : {}) }),
  });

  if (!res.ok) {
    throw new Error(`Apple Business Connect post failed for business ${business.id}: ${res.status}`);
  }

  const data = (await res.json()) as { id?: string };
  if (!data.id) throw new Error(`Apple Business Connect post returned no id for business ${business.id}`);
  return { platformPostId: data.id };
}

interface ApplebusinessInsight {
  views: number;
  clicks: number;
  engagement: number;
}

/** Apple Business Connect is a directory platform — no post-level analytics
 * exist; returns zeros. */
export async function fetchApplebusinessInsights(
  _business: Business,
  _platformPostId: string
): Promise<ApplebusinessInsight> {
  return { views: 0, clicks: 0, engagement: 0 };
}
