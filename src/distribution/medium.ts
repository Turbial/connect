import type { Business, ContentItem } from "../types.js";

/**
 * Medium's API (deprecated for new public OAuth app registration, but the
 * legacy integration-token model still works for existing tokens). Posts to
 * the business's publication via POST /v1/users/{userId}/posts.
 */
const MEDIUM_API_BASE = "https://api.medium.com/v1";

export interface MediumPostResult {
  platformPostId: string;
}

export async function postToMedium(business: Business, item: ContentItem): Promise<MediumPostResult> {
  if (!business.medium_publication_id || !business.medium_access_token) {
    throw new Error(`Business ${business.id} is not connected to Medium`);
  }

  const res = await fetch(`${MEDIUM_API_BASE}/publications/${business.medium_publication_id}/posts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${business.medium_access_token}`,
    },
    body: JSON.stringify({
      title: item.caption.slice(0, 100),
      contentFormat: "html",
      content: item.media_url
        ? `<img src="${item.media_url}" /><p>${item.caption}</p>`
        : `<p>${item.caption}</p>`,
      publishStatus: "public",
    }),
  });

  if (!res.ok) {
    throw new Error(`Medium post failed for business ${business.id}: ${res.status}`);
  }

  const data = (await res.json()) as { data?: { id?: string } };
  const id = data.data?.id;
  if (!id) throw new Error(`Medium post returned no id for business ${business.id}`);
  return { platformPostId: id };
}

interface MediumInsight {
  views: number;
  clicks: number;
  engagement: number;
}

/** Medium's public API doesn't expose post-level stats (claps/views) —
 * returns zeros. */
export async function fetchMediumInsights(_business: Business, _platformPostId: string): Promise<MediumInsight> {
  return { views: 0, clicks: 0, engagement: 0 };
}
