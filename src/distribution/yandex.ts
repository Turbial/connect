import type { Business, ContentItem } from "../types.js";

/**
 * Yandex Business is a directory-listing platform — "posting" here updates
 * the business's listing/news feed via the Yandex Business API.
 */
const YANDEX_API_BASE = "https://api.business.yandex.ru/v1/businesses";

export interface YandexPostResult {
  platformPostId: string;
}

export async function postToYandex(business: Business, item: ContentItem): Promise<YandexPostResult> {
  if (!business.yandex_business_id || !business.yandex_access_token) {
    throw new Error(`Business ${business.id} is not connected to Yandex Business`);
  }

  const res = await fetch(`${YANDEX_API_BASE}/${business.yandex_business_id}/posts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${business.yandex_access_token}`,
    },
    body: JSON.stringify({ text: item.caption, ...(item.media_url ? { photoUrl: item.media_url } : {}) }),
  });

  if (!res.ok) {
    throw new Error(`Yandex Business post failed for business ${business.id}: ${res.status}`);
  }

  const data = (await res.json()) as { id?: string };
  if (!data.id) throw new Error(`Yandex Business post returned no id for business ${business.id}`);
  return { platformPostId: data.id };
}

interface YandexInsight {
  views: number;
  clicks: number;
  engagement: number;
}

/** Yandex Business is a directory platform — no post-level analytics exist;
 * returns zeros. */
export async function fetchYandexInsights(_business: Business, _platformPostId: string): Promise<YandexInsight> {
  return { views: 0, clicks: 0, engagement: 0 };
}
