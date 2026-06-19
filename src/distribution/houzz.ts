import type { Business, ContentItem } from "../types.js";

/**
 * Houzz is a directory/portfolio platform for home professionals —
 * "posting" here adds a photo to the business's project portfolio via the
 * Houzz Pro API.
 */
const HOUZZ_API_BASE = "https://api.houzz.com/v2/pro/photos";

export interface HouzzPostResult {
  platformPostId: string;
}

export async function postToHouzz(business: Business, item: ContentItem): Promise<HouzzPostResult> {
  if (!business.houzz_business_id || !business.houzz_access_token) {
    throw new Error(`Business ${business.id} is not connected to Houzz`);
  }

  const res = await fetch(HOUZZ_API_BASE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${business.houzz_access_token}`,
    },
    body: JSON.stringify({
      business_id: business.houzz_business_id,
      caption: item.caption,
      photo_url: item.media_url,
    }),
  });

  if (!res.ok) {
    throw new Error(`Houzz post failed for business ${business.id}: ${res.status}`);
  }

  const data = (await res.json()) as { id?: string };
  if (!data.id) throw new Error(`Houzz post returned no id for business ${business.id}`);
  return { platformPostId: data.id };
}

interface HouzzInsight {
  views: number;
  clicks: number;
  engagement: number;
}

/** Houzz is a directory platform — no post-level analytics exist; returns
 * zeros. */
export async function fetchHouzzInsights(_business: Business, _platformPostId: string): Promise<HouzzInsight> {
  return { views: 0, clicks: 0, engagement: 0 };
}
