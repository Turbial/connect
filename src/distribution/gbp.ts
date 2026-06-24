import type { Business, ContentItem } from "../types.js";
import { decryptCredential } from "../lib/platformCredentials.js";

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
const TOKEN_URL = "https://oauth2.googleapis.com/token";

export interface GbpPostResult {
  platformPostId: string;
}

/** Google access tokens expire in ~1hr; gbp_refresh_token was being stored
 * but never used, so every call after the first hour was silently relying
 * on a dead access token. Mirrors the same refresh-on-every-call pattern
 * youtube.ts uses (refresh tokens are reusable, so there's no need to cache
 * the resulting access token across calls). */
async function getAccessToken(business: Business): Promise<string> {
  const clientId = process.env.GBP_CLIENT_ID;
  const clientSecret = process.env.GBP_CLIENT_SECRET;
  const gbpRefreshToken = decryptCredential(business.gbp_refresh_token);
  if (clientId && clientSecret && gbpRefreshToken) {
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: gbpRefreshToken,
        grant_type: "refresh_token",
      }),
    });
    if (res.ok) {
      const data = (await res.json()) as { access_token: string };
      return data.access_token;
    }
    // Falls through to the stored access token below — better to try a
    // possibly-stale token than fail outright when refresh itself errors.
  }

  const token = decryptCredential(business.gbp_access_token);
  if (!token) {
    throw new Error(`Business ${business.id} has no GBP access token`);
  }
  return token;
}

export async function postToGbp(business: Business, item: ContentItem): Promise<GbpPostResult> {
  if (!business.gbp_location_id) {
    throw new Error(`Business ${business.id} is not connected to a GBP location`);
  }
  const accessToken = await getAccessToken(business);

  const res = await fetch(GBP_POSTS_ENDPOINT(business.gbp_location_id), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      languageCode: "en-US",
      summary: item.caption,
      media: item.media_url ? [{ mediaFormat: "PHOTO", sourceUrl: item.media_url }] : undefined,
    }),
  });

  if (!res.ok) {
    const errorBody = await res.text().catch(() => "");
    throw new Error(`GBP post failed for business ${business.id}: ${res.status} ${errorBody}`);
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
  if (!business.gbp_location_id) {
    throw new Error(`Business ${business.id} has no GBP location`);
  }
  const accessToken = await getAccessToken(business);

  // The Business Profile Performance API reports metrics per-location, not
  // per-post — there is no post-level resource it accepts, so this must
  // always be keyed on the business's location, never platformPostId.
  const res = await fetch(
    `https://businessprofileperformance.googleapis.com/v1/locations/${business.gbp_location_id}:fetchMultiDailyMetricsTimeSeries`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) {
    const errorBody = await res.text().catch(() => "");
    throw new Error(`GBP insights fetch failed for ${platformPostId}: ${res.status} ${errorBody}`);
  }

  const data = (await res.json()) as { views?: number; clicks?: number; calls?: number };
  return {
    views: data.views ?? 0,
    clicks: data.clicks ?? 0,
    calls: data.calls ?? 0,
  };
}
