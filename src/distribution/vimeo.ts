import type { Business, ContentItem } from "../types.js";

/**
 * Vimeo API. Uploads the Content Engine's generated video (item.media_url,
 * item.media_type === "video") via the pull-link upload approach, then
 * polls real play/view stats via GET /videos/{id}?fields=stats.
 */
const VIMEO_API_BASE = "https://api.vimeo.com";

export interface VimeoPostResult {
  platformPostId: string;
}

export async function postToVimeo(business: Business, item: ContentItem): Promise<VimeoPostResult> {
  if (!business.vimeo_user_id || !business.vimeo_access_token) {
    throw new Error(`Business ${business.id} is not connected to Vimeo`);
  }
  if (!item.media_url) {
    throw new Error(`Vimeo requires a video; content item ${item.id} has none`);
  }

  const res = await fetch(`${VIMEO_API_BASE}/me/videos`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${business.vimeo_access_token}`,
    },
    body: JSON.stringify({
      upload: { approach: "pull", link: item.media_url },
      name: item.caption.slice(0, 100),
      description: item.caption,
    }),
  });

  if (!res.ok) {
    throw new Error(`Vimeo upload failed for business ${business.id}: ${res.status}`);
  }

  const data = (await res.json()) as { uri?: string };
  const uri = data.uri;
  if (!uri) throw new Error(`Vimeo upload returned no uri for business ${business.id}`);
  return { platformPostId: uri.replace("/videos/", "") };
}

interface VimeoInsight {
  views: number;
  clicks: number;
  engagement: number;
}

export async function fetchVimeoInsights(business: Business, platformPostId: string): Promise<VimeoInsight> {
  if (!business.vimeo_access_token) {
    throw new Error(`Business ${business.id} has no Vimeo access token`);
  }

  const res = await fetch(`${VIMEO_API_BASE}/videos/${platformPostId}?fields=stats,metadata.connections.comments.total,metadata.connections.likes.total`, {
    headers: { Authorization: `Bearer ${business.vimeo_access_token}` },
  });
  if (!res.ok) {
    throw new Error(`Vimeo insights fetch failed for ${platformPostId}: ${res.status}`);
  }

  const data = (await res.json()) as {
    stats?: { plays?: number };
    metadata?: { connections?: { comments?: { total?: number }; likes?: { total?: number } } };
  };
  const comments = data.metadata?.connections?.comments?.total ?? 0;
  const likes = data.metadata?.connections?.likes?.total ?? 0;
  return {
    views: data.stats?.plays ?? 0,
    clicks: 0,
    engagement: comments + likes,
  };
}
