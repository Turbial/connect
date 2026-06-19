/**
 * Phase 7.1: WhatsApp Business API adapter. Reuses the doc's exact card
 * options (§6) as quick-reply buttons, whose payloads map into the same
 * decision strings parseReply/parseBoostReply already produce for SMS — no
 * parallel decision logic, channel is just a different transport.
 */
export interface WhatsappButton {
  id: string;
  title: string;
}

const CONTENT_APPROVAL_BUTTONS: WhatsappButton[] = [
  { id: "approve_post", title: "Approve & Post" },
  { id: "regenerate_image", title: "Regenerate Image" },
  { id: "edit_caption", title: "Edit Caption" },
  { id: "hold", title: "Hold" },
];

const BOOST_BUTTONS: WhatsappButton[] = [
  { id: "boost_yes", title: "Boost $X" },
  { id: "boost_no", title: "Decline" },
  { id: "boost_why", title: "Show me why" },
];

export function contentApprovalButtons(): WhatsappButton[] {
  return CONTENT_APPROVAL_BUTTONS;
}

export function boostButtons(): WhatsappButton[] {
  return BOOST_BUTTONS;
}

interface SendWhatsappOptions {
  mediaUrl?: string;
  buttons?: WhatsappButton[];
}

/** Sends a WhatsApp message, optionally as an interactive message with a
 * media preview and up to 3 quick-reply buttons (WhatsApp's own limit). */
export async function sendApprovalWhatsapp(to: string, body: string, options: SendWhatsappOptions = {}): Promise<void> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!phoneNumberId || !accessToken) {
    throw new Error("WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN must be set");
  }

  const { buttons, mediaUrl } = options;

  const payload = buttons
    ? {
        messaging_product: "whatsapp",
        to,
        type: "interactive",
        interactive: {
          type: "button",
          ...(mediaUrl ? { header: { type: "image", image: { link: mediaUrl } } } : {}),
          body: { text: body },
          action: { buttons: buttons.slice(0, 3).map((b) => ({ type: "reply", reply: { id: b.id, title: b.title } })) },
        },
      }
    : {
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body },
      };

  const res = await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`WhatsApp send failed: ${res.status}`);
  }
}

/** Converts a WhatsApp button-click id into the plain text the existing
 * SMS-oriented handlers (handleSmsReply, handleBoostReply,
 * handleEditRewriteReply) already parse via parseReply/parseBoostReply —
 * so a button click is dispatched through the exact same decision code as a
 * typed SMS reply, never a second parallel decision path. Free-text replies
 * (a user typing instead of tapping a button) pass through unchanged. */
export function whatsappButtonToText(buttonIdOrText: string): string {
  switch (buttonIdOrText) {
    case "approve_post":
    case "boost_yes":
      return "yes";
    case "hold":
    case "boost_no":
      return "no";
    case "edit_caption":
    case "regenerate_image":
      return "edit";
    default:
      return buttonIdOrText;
  }
}
