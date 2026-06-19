import type { Business, ContentItem } from "../types.js";

/**
 * Google deprecated most of the original Local Posts API in 2024 and access now
 * goes through the Business Profile API family, gated by an application process
 * (see plan open question: GBP API access has lead time). Confirm the exact
 * endpoint/scopes against the current Business Profile API docs once access is
 * granted — this adapter isolates that detail behind postToGbp() so the rest of
 * the pipeline doesn't depend on it.
 */
const GBP_POSTS_ENDPOINT = (locationId: string) =>
  `https://mybusiness.googleapis.com/v4/${locationId}/localPosts`;

export interface GbpPostResult {
  platformPostId: string;
}

export async function postToGbp(business: Business, item: ContentItem): Promise<GbpPostResult> {
  if (!business.gbp_location_id || !business.gbp_access_token) {
    throw new Error(`Business ${business.id} is not connected to a GBP location`);
  }

  const res = await fetch(GBP_POSTS_ENDPOINT(business.gbp_location_id), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${business.gbp_access_token}`,
    },
    body: JSON.stringify({
      languageCode: "en-US",
      summary: item.caption,
      media: item.media_url ? [{ mediaFormat: "PHOTO", sourceUrl: item.media_url }] : undefined,
    }),
  });

  if (!res.ok) {
    throw new Error(`GBP post failed for business ${business.id}: ${res.status}`);
  }

  const data = (await res.json()) as { name: string };
  return { platformPostId: data.name };
}

interface GbpInsight {
  views: number;
  clicks: number;
  calls: number;
}

export async function fetchGbpInsights(business: Business, platformPostId: string): Promise<GbpInsight> {
  if (!business.gbp_access_token) {
    throw new Error(`Business ${business.id} has no GBP access token`);
  }

  const res = await fetch(
    `https://businessprofileperformance.googleapis.com/v1/${platformPostId}:fetchMultiDailyMetricsTimeSeries`,
    { headers: { Authorization: `Bearer ${business.gbp_access_token}` } }
  );

  if (!res.ok) {
    throw new Error(`GBP insights fetch failed for ${platformPostId}: ${res.status}`);
  }

  const data = (await res.json()) as { views?: number; clicks?: number; calls?: number };
  return {
    views: data.views ?? 0,
    clicks: data.clicks ?? 0,
    calls: data.calls ?? 0,
  };
}
