import type { Business, ContentItem } from "../types.js";

/**
 * Angi (formerly Angie's List) is a directory/review platform for home
 * services — "posting" here updates the business's profile highlight via
 * Angi's partner API. Partner access is granted manually rather than
 * through a self-serve OAuth app, same caveat as Yelp/Nextdoor.
 */
const ANGI_API_BASE = "https://api.angi.com/v1/pros";

export interface AngiPostResult {
  platformPostId: string;
}

export async function postToAngi(business: Business, item: ContentItem): Promise<AngiPostResult> {
  if (!business.angi_business_id || !business.angi_access_token) {
    throw new Error(`Business ${business.id} is not connected to Angi`);
  }

  const res = await fetch(`${ANGI_API_BASE}/${business.angi_business_id}/updates`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${business.angi_access_token}`,
    },
    body: JSON.stringify({ text: item.caption, ...(item.media_url ? { photoUrl: item.media_url } : {}) }),
  });

  if (!res.ok) {
    throw new Error(`Angi post failed for business ${business.id}: ${res.status}`);
  }

  const data = (await res.json()) as { id?: string };
  if (!data.id) throw new Error(`Angi post returned no id for business ${business.id}`);
  return { platformPostId: data.id };
}

interface AngiInsight {
  views: number;
  clicks: number;
  engagement: number;
}

/** Angi is a directory/review platform — no post-level analytics exist;
 * returns zeros. */
export async function fetchAngiInsights(_business: Business, _platformPostId: string): Promise<AngiInsight> {
  return { views: 0, clicks: 0, engagement: 0 };
}
