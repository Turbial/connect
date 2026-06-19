import type { Business, ContentItem } from "../types.js";

/**
 * Yelp Fusion's Business Owner-facing "business updates" surface is part of
 * Yelp's partner program rather than the public Fusion API; the exact host
 * needs confirming once partner access is granted (same lead-time caveat as
 * GBP and Google Ads). This adapter isolates that detail so the rest of the
 * pipeline only depends on postToYelp()'s signature.
 */
const YELP_API_BASE = "https://api.yelp.com/v3";

export interface YelpPostResult {
  platformPostId: string;
}

export async function postToYelp(business: Business, item: ContentItem): Promise<YelpPostResult> {
  if (!business.yelp_business_id || !business.yelp_access_token) {
    throw new Error(`Business ${business.id} is not connected to a Yelp business page`);
  }

  const res = await fetch(`${YELP_API_BASE}/businesses/${business.yelp_business_id}/updates`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${business.yelp_access_token}`,
    },
    body: JSON.stringify({
      text: item.caption,
      ...(item.media_url ? { photo_url: item.media_url } : {}),
    }),
  });

  if (!res.ok) {
    throw new Error(`Yelp post failed for business ${business.id}: ${res.status}`);
  }

  const data = (await res.json()) as { id: string };
  return { platformPostId: data.id };
}

interface YelpInsight {
  views: number;
  clicks: number;
  engagement: number;
}

export async function fetchYelpInsights(business: Business, platformPostId: string): Promise<YelpInsight> {
  if (!business.yelp_access_token) {
    throw new Error(`Business ${business.id} has no Yelp access token`);
  }

  const res = await fetch(`${YELP_API_BASE}/businesses/${business.yelp_business_id}/updates/${platformPostId}/stats`, {
    headers: { Authorization: `Bearer ${business.yelp_access_token}` },
  });
  if (!res.ok) {
    throw new Error(`Yelp insights fetch failed for ${platformPostId}: ${res.status}`);
  }

  const data = (await res.json()) as { views?: number; clicks?: number; engagement?: number };
  return {
    views: data.views ?? 0,
    clicks: data.clicks ?? 0,
    engagement: data.engagement ?? 0,
  };
}
