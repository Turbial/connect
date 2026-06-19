import type { Business, ContentItem } from "../types.js";

/** Pinterest API v5 — a pin is created directly on a board, no two-step container needed. */
const PINTEREST_API_BASE = "https://api.pinterest.com/v5";

export interface PinterestPostResult {
  platformPostId: string;
}

export async function postToPinterest(business: Business, item: ContentItem): Promise<PinterestPostResult> {
  if (!business.pinterest_board_id || !business.pinterest_access_token) {
    throw new Error(`Business ${business.id} is not connected to a Pinterest board`);
  }
  if (!item.media_url) {
    throw new Error(`Pinterest pins require an image; content item ${item.id} has none`);
  }

  const res = await fetch(`${PINTEREST_API_BASE}/pins`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${business.pinterest_access_token}`,
    },
    body: JSON.stringify({
      board_id: business.pinterest_board_id,
      description: item.caption,
      media_source: { source_type: "image_url", url: item.media_url },
    }),
  });

  if (!res.ok) {
    throw new Error(`Pinterest post failed for business ${business.id}: ${res.status}`);
  }

  const data = (await res.json()) as { id: string };
  return { platformPostId: data.id };
}

interface PinterestInsight {
  views: number;
  clicks: number;
  engagement: number;
}

export async function fetchPinterestInsights(business: Business, platformPostId: string): Promise<PinterestInsight> {
  if (!business.pinterest_access_token) {
    throw new Error(`Business ${business.id} has no Pinterest access token`);
  }

  const res = await fetch(
    `${PINTEREST_API_BASE}/pins/${platformPostId}/analytics?metric_types=IMPRESSION,PIN_CLICK,SAVE`,
    { headers: { Authorization: `Bearer ${business.pinterest_access_token}` } }
  );
  if (!res.ok) {
    throw new Error(`Pinterest insights fetch failed for ${platformPostId}: ${res.status}`);
  }

  const data = (await res.json()) as {
    all?: { lifetime_metrics?: { IMPRESSION?: number; PIN_CLICK?: number; SAVE?: number } };
  };
  const metrics = data.all?.lifetime_metrics ?? {};
  return {
    views: metrics.IMPRESSION ?? 0,
    clicks: metrics.PIN_CLICK ?? 0,
    engagement: metrics.SAVE ?? 0,
  };
}
