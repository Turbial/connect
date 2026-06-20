import type { Business, ContentItem } from "../types.js";

/**
 * WhatsApp Business Cloud API. Organic "posting" here means broadcasting a
 * template/media message to the business's existing customer opt-in list,
 * since WhatsApp has no public feed concept — closest organic distribution
 * analog available on the platform.
 */
const WHATSAPP_API_BASE = "https://graph.facebook.com/v19.0";

export interface WhatsappPostResult {
  platformPostId: string;
}

export async function postToWhatsapp(business: Business, item: ContentItem): Promise<WhatsappPostResult> {
  if (!business.whatsapp_phone_number_id || !business.whatsapp_access_token) {
    throw new Error(`Business ${business.id} is not connected to WhatsApp`);
  }

  // The Cloud API has no "broadcast to my followers" concept — every send
  // requires a `to` recipient, and there is no opt-in customer-list table in
  // this codebase yet to source one from. Failing loudly here (instead of
  // sending a request Meta will reject anyway) avoids burning API quota and
  // makes the real gap — recipient-list infrastructure doesn't exist —
  // visible instead of surfacing as an opaque 400 from Meta.
  if (!business.whatsapp_broadcast_recipient) {
    throw new Error(
      `Business ${business.id} has no WhatsApp broadcast recipient configured — organic WhatsApp distribution requires a customer opt-in list, which doesn't exist yet`,
    );
  }

  const res = await fetch(`${WHATSAPP_API_BASE}/${business.whatsapp_phone_number_id}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${business.whatsapp_access_token}`,
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: business.whatsapp_broadcast_recipient,
      type: item.media_url ? "image" : "text",
      ...(item.media_url
        ? { image: { link: item.media_url, caption: item.caption } }
        : { text: { body: item.caption } }),
    }),
  });

  if (!res.ok) {
    const errorBody = await res.text().catch(() => "");
    throw new Error(`WhatsApp post failed for business ${business.id}: ${res.status} ${errorBody}`);
  }

  const data = (await res.json()) as { messages?: { id: string }[] };
  const id = data.messages?.[0]?.id;
  if (!id) throw new Error(`WhatsApp post returned no message id for business ${business.id}`);
  return { platformPostId: id };
}

interface WhatsappInsight {
  views: number;
  clicks: number;
  engagement: number;
}

/** WhatsApp's Cloud API exposes delivery/read status via webhooks, not a pull
 * insights endpoint — this returns zeros until a status-webhook ingestion
 * path is built. */
export async function fetchWhatsappInsights(_business: Business, _platformPostId: string): Promise<WhatsappInsight> {
  return { views: 0, clicks: 0, engagement: 0 };
}
