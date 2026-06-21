import type { Business, ContentItem } from "../types.js";

/**
 * X (Twitter) API v2. Media must be uploaded via the older v1.1 media/upload
 * endpoint first (v2 has no direct image upload), then attached by id to the
 * v2 tweet create call.
 */
const TWITTER_UPLOAD_URL = "https://upload.twitter.com/1.1/media/upload.json";
const TWITTER_API_BASE = "https://api.twitter.com/2";

export interface TwitterPostResult {
  platformPostId: string;
}

async function uploadMedia(business: Business, mediaUrl: string): Promise<string> {
  const imageRes = await fetch(mediaUrl);
  if (!imageRes.ok) throw new Error(`Failed to fetch media for upload: ${imageRes.status}`);
  const imageBuffer = await imageRes.arrayBuffer();

  const form = new FormData();
  form.append("media", new Blob([imageBuffer]));

  const res = await fetch(TWITTER_UPLOAD_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${business.twitter_access_token}` },
    body: form,
  });
  if (!res.ok) throw new Error(`X media upload failed for business ${business.id}: ${res.status}`);

  const data = (await res.json()) as { media_id_string: string };
  return data.media_id_string;
}

export async function postToTwitter(business: Business, item: ContentItem): Promise<TwitterPostResult> {
  if (!business.twitter_access_token) {
    throw new Error(`Business ${business.id} is not connected to X`);
  }

  const mediaId = item.media_url ? await uploadMedia(business, item.media_url) : null;

  const res = await fetch(`${TWITTER_API_BASE}/tweets`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${business.twitter_access_token}`,
    },
    body: JSON.stringify({
      text: item.caption,
      ...(mediaId ? { media: { media_ids: [mediaId] } } : {}),
    }),
  });

  if (!res.ok) {
    throw new Error(`X post failed for business ${business.id}: ${res.status}`);
  }

  const data = (await res.json()) as { data: { id: string } };
  return { platformPostId: data.data.id };
}

interface TwitterInsight {
  views: number;
  clicks: number;
  engagement: number;
}

export async function fetchTwitterInsights(business: Business, platformPostId: string): Promise<TwitterInsight> {
  if (!business.twitter_access_token) {
    throw new Error(`Business ${business.id} has no X access token`);
  }

  const res = await fetch(
    `${TWITTER_API_BASE}/tweets/${platformPostId}?tweet.fields=public_metrics,non_public_metrics`,
    { headers: { Authorization: `Bearer ${business.twitter_access_token}` } }
  );
  if (!res.ok) {
    throw new Error(`X insights fetch failed for ${platformPostId}: ${res.status}`);
  }

  const data = (await res.json()) as {
    data: { public_metrics?: { like_count?: number; reply_count?: number }; non_public_metrics?: { impression_count?: number } };
  };
  const pub = data.data.public_metrics ?? {};
  const nonPub = data.data.non_public_metrics ?? {};
  return {
    views: nonPub.impression_count ?? 0,
    clicks: 0,
    engagement: (pub.like_count ?? 0) + (pub.reply_count ?? 0),
  };
}
