import type { Business, ContentItem } from "../types.js";

/**
 * Tripadvisor Content API. Tripadvisor is a review/listing platform —
 * "posting" here uploads a photo update to the business's location via the
 * Content API's location media endpoint.
 */
const TRIPADVISOR_API_BASE = "https://api.tripadvisor.com/api/partner/2.0/location";

export interface TripadvisorPostResult {
  platformPostId: string;
}

export async function postToTripadvisor(business: Business, item: ContentItem): Promise<TripadvisorPostResult> {
  if (!business.tripadvisor_location_id || !business.tripadvisor_access_token) {
    throw new Error(`Business ${business.id} is not connected to Tripadvisor`);
  }

  const res = await fetch(`${TRIPADVISOR_API_BASE}/${business.tripadvisor_location_id}/media`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${business.tripadvisor_access_token}`,
    },
    body: JSON.stringify({ caption: item.caption, ...(item.media_url ? { photoUrl: item.media_url } : {}) }),
  });

  if (!res.ok) {
    throw new Error(`Tripadvisor post failed for business ${business.id}: ${res.status}`);
  }

  const data = (await res.json()) as { id?: string };
  if (!data.id) throw new Error(`Tripadvisor post returned no id for business ${business.id}`);
  return { platformPostId: data.id };
}

interface TripadvisorInsight {
  views: number;
  clicks: number;
  engagement: number;
}

/** Tripadvisor is a review/listing platform — no post-level analytics exist;
 * returns zeros. */
export async function fetchTripadvisorInsights(_business: Business, _platformPostId: string): Promise<TripadvisorInsight> {
  return { views: 0, clicks: 0, engagement: 0 };
}
