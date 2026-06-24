import { supabase } from "./supabase.js";
import { classifyMessageIntent, routeLeadIntentMessage } from "./messageIntent.js";
import type { Business, CustomerMessage } from "../types.js";

export interface RecordCustomerMessageInput {
  businessId: string;
  channel: CustomerMessage["channel"];
  direction: CustomerMessage["direction"];
  customerIdentifier: string;
  body?: string | null;
}

/** Generic ingestion point for any customer<->business message (Phase 5.3) —
 * missed-call text-back, and the call shape any future webchat-widget or
 * DM-platform webhook would use, mirroring src/lib/leadEvents.ts's pattern.
 * No webchat widget or DM integration exists in this codebase today; this is
 * the seam they'd plug into. Phase 8.8: inbound messages get classified into
 * a fixed intent category, and a lead_intent message is forwarded to the
 * business's CRM webhook (if configured) — outbound messages are never
 * classified since there's no customer reply to detect intent from. */
export async function recordCustomerMessage(input: RecordCustomerMessageInput): Promise<void> {
  const intent = input.direction === "inbound" ? await classifyMessageIntent(input.body ?? null) : null;

  const { data: inserted, error } = await supabase
    .from("customer_message")
    .insert({
      business_id: input.businessId,
      channel: input.channel,
      direction: input.direction,
      customer_identifier: input.customerIdentifier,
      body: input.body ?? null,
      intent,
    })
    .select()
    .single();
  if (error) throw error;

  if (intent === "lead_intent") {
    const { data: business, error: businessError } = await supabase.from("business").select("*").eq("id", input.businessId).single();
    if (businessError) throw businessError;
    await routeLeadIntentMessage(business as Business, inserted as CustomerMessage);
  }
}

/** The "DM inbox" data model the development program calls for — there is no
 * dashboard in this codebase to render it, so a query function is the
 * appropriate scope here, not a UI. */
export async function getInboxForBusiness(businessId: string, sinceISO: string): Promise<CustomerMessage[]> {
  const { data, error } = await supabase
    .from("customer_message")
    .select("*")
    .eq("business_id", businessId)
    .gte("created_at", sinceISO)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as CustomerMessage[];
}

/** Phase 8.8: lead_intent messages within a window, for the weekly digest's
 * flagging line — Connect surfaces the signal in the owner-facing report,
 * it does not store or manage the lead itself beyond this. */
export async function getLeadIntentMessages(businessId: string, sinceISO: string): Promise<CustomerMessage[]> {
  const { data, error } = await supabase
    .from("customer_message")
    .select("*")
    .eq("business_id", businessId)
    .eq("intent", "lead_intent")
    .gte("created_at", sinceISO)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as CustomerMessage[];
}

/** Finds the channel of the most recent inbound message from this customer
 * identifier for this business, so a reply can be routed without the caller
 * having to pass the channel explicitly. */
export async function getLatestInboundChannel(businessId: string, customerIdentifier: string): Promise<CustomerMessage["channel"] | null> {
  const { data, error } = await supabase
    .from("customer_message")
    .select("channel")
    .eq("business_id", businessId)
    .eq("customer_identifier", customerIdentifier)
    .eq("direction", "inbound")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data?.channel as CustomerMessage["channel"] | undefined) ?? null;
}

/** Send a WhatsApp reply via Twilio's WhatsApp sandbox/channel.
 * Requires TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER to
 * be set — the from number is auto-prefixed with "whatsapp:" as Twilio
 * requires. */
export async function replyViaWhatsApp(to: string, body: string): Promise<void> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!sid || !token || !from) throw new Error("TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER must be set");

  const toWhatsapp = to.startsWith("whatsapp:") ? to : `whatsapp:${to}`;
  const fromWhatsapp = from.startsWith("whatsapp:") ? from : `whatsapp:${from}`;

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: toWhatsapp, From: fromWhatsapp, Body: body }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Twilio WhatsApp send failed (${res.status}): ${detail}`);
  }
}
