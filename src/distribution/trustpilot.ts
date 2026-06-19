import type { Business, ContentItem } from "../types.js";

/**
 * Trustpilot is a review platform — "posting" here publishes a business
 * update to the business's profile via the Trustpilot Business API, scoped
 * to its business unit.
 */
const TRUSTPILOT_API_BASE = "https://api.trustpilot.com/v1/business-units";

export interface TrustpilotPostResult {
  platformPostId: string;
}

export async function postToTrustpilot(business: Business, item: ContentItem): Promise<TrustpilotPostResult> {
  if (!business.trustpilot_business_unit_id || !business.trustpilot_access_token) {
    throw new Error(`Business ${business.id} is not connected to Trustpilot`);
  }

  const res = await fetch(`${TRUSTPILOT_API_BASE}/${business.trustpilot_business_unit_id}/updates`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${business.trustpilot_access_token}`,
    },
    body: JSON.stringify({ text: item.caption, ...(item.media_url ? { photoUrl: item.media_url } : {}) }),
  });

  if (!res.ok) {
    throw new Error(`Trustpilot post failed for business ${business.id}: ${res.status}`);
  }

  const data = (await res.json()) as { id?: string };
  if (!data.id) throw new Error(`Trustpilot post returned no id for business ${business.id}`);
  return { platformPostId: data.id };
}

interface TrustpilotInsight {
  views: number;
  clicks: number;
  engagement: number;
}

/** Trustpilot is a review platform — no post-level analytics exist; returns
 * zeros. */
export async function fetchTrustpilotInsights(_business: Business, _platformPostId: string): Promise<TrustpilotInsight> {
  return { views: 0, clicks: 0, engagement: 0 };
}
