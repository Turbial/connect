import type { Business, ContentItem } from "../types.js";

/**
 * TikTok Content Posting API. Posting a video is a two-step flow: initialize
 * the post (PULL_FROM_URL so TikTok fetches the fal.ai-hosted video directly,
 * avoiding a local re-upload), then poll publish status for the resulting
 * video id. Exact field names should be confirmed against a live sandbox app
 * once TikTok developer access is granted — this targets the documented
 * `/v2/post/publish/video/init/` content posting surface.
 */
const TIKTOK_API_BASE = "https://open.tiktokapis.com/v2";

export interface TiktokPostResult {
  platformPostId: string;
}

export async function postToTiktok(business: Business, item: ContentItem): Promise<TiktokPostResult> {
  if (!business.tiktok_user_id || !business.tiktok_access_token) {
    throw new Error(`Business ${business.id} is not connected to TikTok`);
  }
  if (!item.media_url) {
    throw new Error(`TikTok posts require a video; content item ${item.id} has none`);
  }

  const res = await fetch(`${TIKTOK_API_BASE}/post/publish/video/init/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${business.tiktok_access_token}`,
    },
    body: JSON.stringify({
      post_info: {
        title: item.caption,
        privacy_level: "PUBLIC_TO_EVERYONE",
      },
      source_info: {
        source: "PULL_FROM_URL",
        video_url: item.media_url,
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`TikTok post failed for business ${business.id}: ${res.status}`);
  }

  const data = (await res.json()) as { data?: { publish_id: string } };
  if (!data.data?.publish_id) {
    throw new Error(`TikTok post init returned no publish_id for business ${business.id}`);
  }

  return { platformPostId: data.data.publish_id };
}

interface TiktokInsight {
  views: number;
  clicks: number;
  engagement: number;
}

export async function fetchTiktokInsights(business: Business, platformPostId: string): Promise<TiktokInsight> {
  if (!business.tiktok_access_token) {
    throw new Error(`Business ${business.id} has no TikTok access token`);
  }

  const res = await fetch(`${TIKTOK_API_BASE}/post/publish/status/fetch/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${business.tiktok_access_token}`,
    },
    body: JSON.stringify({ publish_id: platformPostId }),
  });

  if (!res.ok) {
    throw new Error(`TikTok insights fetch failed for ${platformPostId}: ${res.status}`);
  }

  const data = (await res.json()) as {
    data?: { video_view_count?: number; like_count?: number; comment_count?: number; share_count?: number };
  };
  const stats = data.data ?? {};
  return {
    views: stats.video_view_count ?? 0,
    clicks: 0,
    engagement: (stats.like_count ?? 0) + (stats.comment_count ?? 0) + (stats.share_count ?? 0),
  };
}
