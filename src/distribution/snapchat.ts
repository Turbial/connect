import type { Business, ContentItem } from "../types.js";

/**
 * Snapchat's Creative Kit/Profile API for organic Spotlight-style posts.
 * Like the other image-upload platforms, media must be uploaded to get a
 * media id before it can be attached to a post.
 */
const SNAPCHAT_API_BASE = "https://adsapi.snapchat.com/v1";

export interface SnapchatPostResult {
  platformPostId: string;
}

async function uploadMedia(business: Business, mediaUrl: string): Promise<string> {
  const imageRes = await fetch(mediaUrl);
  if (!imageRes.ok) throw new Error(`Failed to fetch media for upload: ${imageRes.status}`);
  const imageBuffer = await imageRes.arrayBuffer();

  const form = new FormData();
  form.append("file", new Blob([imageBuffer]));

  const res = await fetch(`${SNAPCHAT_API_BASE}/profiles/${business.snapchat_profile_id}/media`, {
    method: "POST",
    headers: { Authorization: `Bearer ${business.snapchat_access_token}` },
    body: form,
  });
  if (!res.ok) throw new Error(`Snapchat media upload failed for business ${business.id}: ${res.status}`);

  const data = (await res.json()) as { media_id: string };
  return data.media_id;
}

export async function postToSnapchat(business: Business, item: ContentItem): Promise<SnapchatPostResult> {
  if (!business.snapchat_profile_id || !business.snapchat_access_token) {
    throw new Error(`Business ${business.id} is not connected to Snapchat`);
  }
  if (!item.media_url) {
    throw new Error(`Snapchat posts require an image; content item ${item.id} has none`);
  }

  const mediaId = await uploadMedia(business, item.media_url);

  const res = await fetch(`${SNAPCHAT_API_BASE}/profiles/${business.snapchat_profile_id}/stories`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${business.snapchat_access_token}`,
    },
    body: JSON.stringify({ media_id: mediaId, caption: item.caption }),
  });

  if (!res.ok) {
    throw new Error(`Snapchat post failed for business ${business.id}: ${res.status}`);
  }

  const data = (await res.json()) as { id: string };
  return { platformPostId: data.id };
}

interface SnapchatInsight {
  views: number;
  clicks: number;
  engagement: number;
}

export async function fetchSnapchatInsights(business: Business, platformPostId: string): Promise<SnapchatInsight> {
  if (!business.snapchat_access_token) {
    throw new Error(`Business ${business.id} has no Snapchat access token`);
  }

  const res = await fetch(`${SNAPCHAT_API_BASE}/stories/${platformPostId}/stats`, {
    headers: { Authorization: `Bearer ${business.snapchat_access_token}` },
  });
  if (!res.ok) {
    throw new Error(`Snapchat insights fetch failed for ${platformPostId}: ${res.status}`);
  }

  const data = (await res.json()) as { views?: number; screenshots?: number; shares?: number };
  return {
    views: data.views ?? 0,
    clicks: 0,
    engagement: (data.screenshots ?? 0) + (data.shares ?? 0),
  };
}
