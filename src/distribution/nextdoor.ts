import type { Business, ContentItem } from "../types.js";

/**
 * Nextdoor's Business Posts API is part of its Business/Agency Partner
 * Program (no fully public self-serve docs at time of writing) — isolated
 * behind this adapter so the endpoint/auth details can be confirmed once
 * partner access is granted without touching the rest of the pipeline.
 */
const NEXTDOOR_API_BASE = "https://api.nextdoor.com/v2";

export interface NextdoorPostResult {
  platformPostId: string;
}

export async function postToNextdoor(business: Business, item: ContentItem): Promise<NextdoorPostResult> {
  if (!business.nextdoor_business_id || !business.nextdoor_access_token) {
    throw new Error(`Business ${business.id} is not connected to Nextdoor`);
  }

  const res = await fetch(`${NEXTDOOR_API_BASE}/businesses/${business.nextdoor_business_id}/posts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${business.nextdoor_access_token}`,
    },
    body: JSON.stringify({
      body: item.caption,
      ...(item.media_url ? { image_url: item.media_url } : {}),
    }),
  });

  if (!res.ok) {
    throw new Error(`Nextdoor post failed for business ${business.id}: ${res.status}`);
  }

  const data = (await res.json()) as { id: string };
  return { platformPostId: data.id };
}

interface NextdoorInsight {
  views: number;
  clicks: number;
  engagement: number;
}

export async function fetchNextdoorInsights(business: Business, platformPostId: string): Promise<NextdoorInsight> {
  if (!business.nextdoor_access_token) {
    throw new Error(`Business ${business.id} has no Nextdoor access token`);
  }

  const res = await fetch(`${NEXTDOOR_API_BASE}/posts/${platformPostId}/stats`, {
    headers: { Authorization: `Bearer ${business.nextdoor_access_token}` },
  });
  if (!res.ok) {
    throw new Error(`Nextdoor insights fetch failed for ${platformPostId}: ${res.status}`);
  }

  const data = (await res.json()) as { impressions?: number; clicks?: number; reactions?: number };
  return {
    views: data.impressions ?? 0,
    clicks: data.clicks ?? 0,
    engagement: data.reactions ?? 0,
  };
}
