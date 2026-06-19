import { callDeepSeekPrompt } from "../content-engine/generate.js";
import { sendApprovalMessage } from "../approval/channel.js";
import { logAgentAction } from "./agentAction.js";
import type { Business, CustomerMessage, MessageIntent } from "../types.js";

const CATEGORIES: MessageIntent[] = ["lead_intent", "question", "complaint", "other"];

/** Phase 8.8: classifies an inbound customer message into one of the fixed
 * categories, or null when there's no body to classify, no DEEPSEEK_API_KEY
 * configured (same graceful-degradation pattern as classifyEditReply), or
 * the model's answer doesn't match a known category — never guesses. */
export async function classifyMessageIntent(body: string | null): Promise<MessageIntent | null> {
  if (!body) return null;

  const result = await callDeepSeekPrompt(
    `A customer sent this message to a local business: "${body}". Classify it into exactly one of these categories: ${CATEGORIES.join(", ")}. "lead_intent" means the customer is asking about pricing, availability, or wants to book/buy. Respond with only the category name, nothing else.`
  );
  if (!result) return null;

  const category = result.trim() as MessageIntent;
  return CATEGORIES.includes(category) ? category : null;
}

/** Phase 9.1: alerts the owner immediately on their preferred channel that a
 * lead_intent message came in — additive to (not a replacement for) the
 * webhook forward below and the weekly digest count, so a business with no
 * CRM webhook configured still gets told about the lead today, not next
 * Monday. Best-effort, same as the webhook forward: a send failure is
 * swallowed rather than thrown, since it must never block the
 * customer-facing reply flow that triggered it. */
async function notifyOwnerOfLeadIntent(business: Business, message: CustomerMessage): Promise<void> {
  try {
    await sendApprovalMessage(
      business,
      "New lead",
      `New ${message.channel} message that looks like a lead: "${message.body}"`
    );
    await logAgentAction({
      businessId: business.id,
      source: "customer_message",
      intent: "notify_lead_intent",
      tool: "notify_lead_intent",
      input: { customerIdentifier: message.customer_identifier, channel: message.channel },
      status: "completed",
      riskLevel: "low",
      approvalRequired: false,
    });
  } catch {
    // Best-effort; the lead is still forwarded/counted elsewhere regardless
    // of whether the owner's configured channel is reachable right now.
  }
}

/** Phase 8.8: forwards a lead_intent message to the business's configured
 * external CRM webhook, if any — Connect routes the signal, it never stores
 * or manages the lead itself. Best-effort: a forwarding failure is swallowed
 * rather than thrown, since it must never block the customer-facing reply
 * flow that triggered it. */
export async function routeLeadIntentMessage(business: Business, message: CustomerMessage): Promise<void> {
  if (message.intent !== "lead_intent") return;

  await notifyOwnerOfLeadIntent(business, message);

  if (!business.crm_webhook_url) return;

  try {
    await fetch(business.crm_webhook_url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        business_id: business.id,
        customer_identifier: message.customer_identifier,
        channel: message.channel,
        body: message.body,
        occurred_at: message.created_at,
      }),
    });
  } catch {
    // Forwarding is best-effort; the message is still recorded/flagged in
    // Connect's own digest regardless of whether the external system is reachable.
  }
}
