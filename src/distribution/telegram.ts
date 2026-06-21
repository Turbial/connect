import type { Business, ContentItem } from "../types.js";

/**
 * Telegram Bot API. Posts to the business's configured channel using the bot
 * token as the per-business access token (bot tokens are generated via
 * @BotFather and are channel-scoped, so no app-level OAuth client exists).
 */
const TELEGRAM_API_BASE = "https://api.telegram.org";

export interface TelegramPostResult {
  platformPostId: string;
}

export async function postToTelegram(business: Business, item: ContentItem): Promise<TelegramPostResult> {
  if (!business.telegram_channel_id || !business.telegram_access_token) {
    throw new Error(`Business ${business.id} is not connected to Telegram`);
  }

  const method = item.media_url ? "sendPhoto" : "sendMessage";
  const res = await fetch(`${TELEGRAM_API_BASE}/bot${business.telegram_access_token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: business.telegram_channel_id,
      ...(item.media_url ? { photo: item.media_url, caption: item.caption } : { text: item.caption }),
    }),
  });

  if (!res.ok) {
    throw new Error(`Telegram post failed for business ${business.id}: ${res.status}`);
  }

  const data = (await res.json()) as { result?: { message_id?: number } };
  const id = data.result?.message_id;
  if (id === undefined) throw new Error(`Telegram post returned no message id for business ${business.id}`);
  return { platformPostId: String(id) };
}

interface TelegramInsight {
  views: number;
  clicks: number;
  engagement: number;
}

/** Telegram's Bot API has no post analytics endpoint — returns zeros until
 * channel stats are sourced some other way (e.g. Telegram Analytics for
 * channels with 500+ subscribers, which isn't bot-API accessible). */
export async function fetchTelegramInsights(_business: Business, _platformPostId: string): Promise<TelegramInsight> {
  return { views: 0, clicks: 0, engagement: 0 };
}
