import type { Business, ContentItem } from "../types.js";

/**
 * Quora API for Business. Posts to the business's configured Space via the
 * Spaces posting endpoint.
 */
const QUORA_API_BASE = "https://api.quora.com/v1/spaces";

export interface QuoraPostResult {
  platformPostId: string;
}

export async function postToQuora(business: Business, item: ContentItem): Promise<QuoraPostResult> {
  if (!business.quora_space_id || !business.quora_access_token) {
    throw new Error(`Business ${business.id} is not connected to Quora`);
  }

  const res = await fetch(`${QUORA_API_BASE}/${business.quora_space_id}/posts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${business.quora_access_token}`,
    },
    body: JSON.stringify({ content: item.caption, ...(item.media_url ? { imageUrl: item.media_url } : {}) }),
  });

  if (!res.ok) {
    throw new Error(`Quora post failed for business ${business.id}: ${res.status}`);
  }

  const data = (await res.json()) as { id?: string };
  if (!data.id) throw new Error(`Quora post returned no id for business ${business.id}`);
  return { platformPostId: data.id };
}

interface QuoraInsight {
  views: number;
  clicks: number;
  engagement: number;
}

/** Quora for Business exposes Space-level analytics, not stable per-post
 * read APIs for third-party apps yet — returns zeros until that surface is
 * confirmed. */
export async function fetchQuoraInsights(_business: Business, _platformPostId: string): Promise<QuoraInsight> {
  return { views: 0, clicks: 0, engagement: 0 };
}
