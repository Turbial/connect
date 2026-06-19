import { supabase } from "./supabase.js";
import type { CustomerMessage } from "../types.js";

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
 * the seam they'd plug into. */
export async function recordCustomerMessage(input: RecordCustomerMessageInput): Promise<void> {
  const { error } = await supabase.from("customer_message").insert({
    business_id: input.businessId,
    channel: input.channel,
    direction: input.direction,
    customer_identifier: input.customerIdentifier,
    body: input.body ?? null,
  });
  if (error) throw error;
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
