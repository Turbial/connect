import type { Business, ContentItem } from "../types.js";

/**
 * Discord webhook/bot API. Posts a message (with optional embed image) to
 * the business's configured channel via the channel messages endpoint, using
 * a bot token obtained through the DISCORD_CLIENT_ID/SECRET OAuth2 app.
 */
const DISCORD_API_BASE = "https://discord.com/api/v10";

export interface DiscordPostResult {
  platformPostId: string;
}

export async function postToDiscord(business: Business, item: ContentItem): Promise<DiscordPostResult> {
  if (!business.discord_channel_id || !business.discord_access_token) {
    throw new Error(`Business ${business.id} is not connected to Discord`);
  }

  const res = await fetch(`${DISCORD_API_BASE}/channels/${business.discord_channel_id}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bot ${business.discord_access_token}`,
    },
    body: JSON.stringify({
      content: item.caption,
      ...(item.media_url ? { embeds: [{ image: { url: item.media_url } }] } : {}),
    }),
  });

  if (!res.ok) {
    throw new Error(`Discord post failed for business ${business.id}: ${res.status}`);
  }

  const data = (await res.json()) as { id?: string };
  if (!data.id) throw new Error(`Discord post returned no message id for business ${business.id}`);
  return { platformPostId: data.id };
}

interface DiscordInsight {
  views: number;
  clicks: number;
  engagement: number;
}

/** Discord's API exposes no view-count analytics for ordinary channel
 * messages — returns zeros. */
export async function fetchDiscordInsights(_business: Business, _platformPostId: string): Promise<DiscordInsight> {
  return { views: 0, clicks: 0, engagement: 0 };
}
