import type { Business, ContentItem } from "../types.js";

/**
 * Reddit's API (oauth.reddit.com). Posts a self/link post to the business's
 * configured subreddit using the documented /api/submit endpoint.
 */
const REDDIT_API_BASE = "https://oauth.reddit.com";

export interface RedditPostResult {
  platformPostId: string;
}

export async function postToReddit(business: Business, item: ContentItem): Promise<RedditPostResult> {
  if (!business.reddit_subreddit || !business.reddit_access_token) {
    throw new Error(`Business ${business.id} is not connected to Reddit`);
  }

  const params = new URLSearchParams({
    sr: business.reddit_subreddit,
    title: item.caption.slice(0, 300),
    kind: item.media_url ? "image" : "self",
    ...(item.media_url ? { url: item.media_url } : { text: item.caption }),
  });

  const res = await fetch(`${REDDIT_API_BASE}/api/submit`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Bearer ${business.reddit_access_token}`,
    },
    body: params,
  });

  if (!res.ok) {
    throw new Error(`Reddit post failed for business ${business.id}: ${res.status}`);
  }

  const data = (await res.json()) as { json?: { data?: { id?: string } } };
  const id = data.json?.data?.id;
  if (!id) throw new Error(`Reddit post returned no id for business ${business.id}`);
  return { platformPostId: id };
}

interface RedditInsight {
  views: number;
  clicks: number;
  engagement: number;
}

export async function fetchRedditInsights(business: Business, platformPostId: string): Promise<RedditInsight> {
  if (!business.reddit_access_token) {
    throw new Error(`Business ${business.id} has no Reddit access token`);
  }

  const res = await fetch(`${REDDIT_API_BASE}/api/info?id=t3_${platformPostId}`, {
    headers: { Authorization: `Bearer ${business.reddit_access_token}` },
  });
  if (!res.ok) {
    throw new Error(`Reddit insights fetch failed for ${platformPostId}: ${res.status}`);
  }

  const data = (await res.json()) as {
    data?: { children?: { data?: { score?: number; num_comments?: number } }[] };
  };
  const post = data.data?.children?.[0]?.data ?? {};
  return {
    views: 0,
    clicks: 0,
    engagement: (post.score ?? 0) + (post.num_comments ?? 0),
  };
}
