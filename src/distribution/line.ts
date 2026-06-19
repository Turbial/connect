import type { Business, ContentItem } from "../types.js";

/**
 * LINE Messaging API. Broadcasts a message/media to the business's
 * configured channel via the broadcast endpoint, using a channel access
 * token obtained through the LINE_CHANNEL_ID/SECRET channel (LINE calls its
 * app credential a "channel", not a client).
 */
const LINE_API_BASE = "https://api.line.me/v2/bot/message";

export interface LinePostResult {
  platformPostId: string;
}

export async function postToLine(business: Business, item: ContentItem): Promise<LinePostResult> {
  if (!business.line_channel_id || !business.line_access_token) {
    throw new Error(`Business ${business.id} is not connected to LINE`);
  }

  const res = await fetch(`${LINE_API_BASE}/broadcast`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${business.line_access_token}`,
    },
    body: JSON.stringify({
      messages: [
        item.media_url
          ? { type: "image", originalContentUrl: item.media_url, previewImageUrl: item.media_url }
          : { type: "text", text: item.caption },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`LINE broadcast failed for business ${business.id}: ${res.status}`);
  }

  const data = (await res.json()) as { sentMessages?: { id?: string }[] };
  const id = data.sentMessages?.[0]?.id;
  if (!id) throw new Error(`LINE broadcast returned no message id for business ${business.id}`);
  return { platformPostId: id };
}

interface LineInsight {
  views: number;
  clicks: number;
  engagement: number;
}

/** LINE's broadcast delivery/read stats are aggregate-only (insight/message/delivery),
 * not addressable per message id — returns zeros. */
export async function fetchLineInsights(_business: Business, _platformPostId: string): Promise<LineInsight> {
  return { views: 0, clicks: 0, engagement: 0 };
}
