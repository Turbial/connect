import type { Business, ContentItem } from "../types.js";

/**
 * Tumblr's REST API (v2 Neue Post Format). Posts to the business's
 * configured blog using the npf/posts endpoint with a simple text+image
 * content block.
 */
const TUMBLR_API_BASE = "https://api.tumblr.com/v2";

export interface TumblrPostResult {
  platformPostId: string;
}

export async function postToTumblr(business: Business, item: ContentItem): Promise<TumblrPostResult> {
  if (!business.tumblr_blog_name || !business.tumblr_access_token) {
    throw new Error(`Business ${business.id} is not connected to Tumblr`);
  }

  const content = [
    { type: "text", text: item.caption },
    ...(item.media_url ? [{ type: "image", media: [{ url: item.media_url }] }] : []),
  ];

  const res = await fetch(`${TUMBLR_API_BASE}/blog/${business.tumblr_blog_name}/posts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${business.tumblr_access_token}`,
    },
    body: JSON.stringify({ content }),
  });

  if (!res.ok) {
    throw new Error(`Tumblr post failed for business ${business.id}: ${res.status}`);
  }

  const data = (await res.json()) as { response?: { id: string } };
  const id = data.response?.id;
  if (!id) throw new Error(`Tumblr post returned no id for business ${business.id}`);
  return { platformPostId: id };
}

interface TumblrInsight {
  views: number;
  clicks: number;
  engagement: number;
}

export async function fetchTumblrInsights(business: Business, platformPostId: string): Promise<TumblrInsight> {
  if (!business.tumblr_blog_name || !business.tumblr_access_token) {
    throw new Error(`Business ${business.id} has no Tumblr credentials`);
  }

  const res = await fetch(`${TUMBLR_API_BASE}/blog/${business.tumblr_blog_name}/posts/${platformPostId}`, {
    headers: { Authorization: `Bearer ${business.tumblr_access_token}` },
  });
  if (!res.ok) {
    throw new Error(`Tumblr insights fetch failed for ${platformPostId}: ${res.status}`);
  }

  const data = (await res.json()) as { response?: { note_count?: number } };
  return {
    views: 0,
    clicks: 0,
    engagement: data.response?.note_count ?? 0,
  };
}
