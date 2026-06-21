import type { Business, ContentItem } from "../types.js";

/**
 * Thumbtack is a directory/lead-gen platform for local services —
 * "posting" here updates the business's profile via Thumbtack's partner API.
 */
const THUMBTACK_API_BASE = "https://api.thumbtack.com/v1/businesses";

export interface ThumbtackPostResult {
  platformPostId: string;
}

export async function postToThumbtack(business: Business, item: ContentItem): Promise<ThumbtackPostResult> {
  if (!business.thumbtack_business_id || !business.thumbtack_access_token) {
    throw new Error(`Business ${business.id} is not connected to Thumbtack`);
  }

  const res = await fetch(`${THUMBTACK_API_BASE}/${business.thumbtack_business_id}/updates`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${business.thumbtack_access_token}`,
    },
    body: JSON.stringify({ text: item.caption, ...(item.media_url ? { photoUrl: item.media_url } : {}) }),
  });

  if (!res.ok) {
    throw new Error(`Thumbtack post failed for business ${business.id}: ${res.status}`);
  }

  const data = (await res.json()) as { id?: string };
  if (!data.id) throw new Error(`Thumbtack post returned no id for business ${business.id}`);
  return { platformPostId: data.id };
}

interface ThumbtackInsight {
  views: number;
  clicks: number;
  engagement: number;
}

/** Thumbtack is a directory/lead-gen platform — no post-level analytics
 * exist; returns zeros. */
export async function fetchThumbtackInsights(_business: Business, _platformPostId: string): Promise<ThumbtackInsight> {
  return { views: 0, clicks: 0, engagement: 0 };
}
