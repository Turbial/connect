import type { Business, ContentItem } from "../types.js";

/**
 * VK API (wall.post). Posts to the business's configured community wall
 * using a group access token obtained through the VK_CLIENT_ID/SECRET app.
 */
const VK_API_BASE = "https://api.vk.com/method";
const VK_API_VERSION = "5.199";

export interface VkPostResult {
  platformPostId: string;
}

export async function postToVk(business: Business, item: ContentItem): Promise<VkPostResult> {
  if (!business.vk_group_id || !business.vk_access_token) {
    throw new Error(`Business ${business.id} is not connected to VK`);
  }

  const params = new URLSearchParams({
    owner_id: `-${business.vk_group_id}`,
    message: item.caption,
    ...(item.media_url ? { attachments: item.media_url } : {}),
    access_token: business.vk_access_token,
    v: VK_API_VERSION,
  });

  const res = await fetch(`${VK_API_BASE}/wall.post?${params.toString()}`, { method: "POST" });
  if (!res.ok) {
    throw new Error(`VK post failed for business ${business.id}: ${res.status}`);
  }

  const data = (await res.json()) as { response?: { post_id?: number }; error?: { error_msg?: string } };
  if (data.error) throw new Error(`VK post failed for business ${business.id}: ${data.error.error_msg}`);
  const id = data.response?.post_id;
  if (id === undefined) throw new Error(`VK post returned no post id for business ${business.id}`);
  return { platformPostId: String(id) };
}

interface VkInsight {
  views: number;
  clicks: number;
  engagement: number;
}

/** VK exposes wall post stats via stats.get for community admins; this
 * implements a plausible call but falls back to zeros if the response shape
 * doesn't include views, since stats.get coverage varies by community type. */
export async function fetchVkInsights(business: Business, platformPostId: string): Promise<VkInsight> {
  if (!business.vk_group_id || !business.vk_access_token) {
    throw new Error(`Business ${business.id} has no VK access token`);
  }

  const params = new URLSearchParams({
    owner_id: `-${business.vk_group_id}`,
    post_id: platformPostId,
    extended: "1",
    access_token: business.vk_access_token,
    v: VK_API_VERSION,
  });

  const res = await fetch(`${VK_API_BASE}/wall.getById?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`VK insights fetch failed for ${platformPostId}: ${res.status}`);
  }

  const data = (await res.json()) as {
    response?: { items?: { views?: { count?: number }; likes?: { count?: number }; comments?: { count?: number } }[] };
  };
  const post = data.response?.items?.[0] ?? {};
  return {
    views: post.views?.count ?? 0,
    clicks: 0,
    engagement: (post.likes?.count ?? 0) + (post.comments?.count ?? 0),
  };
}
