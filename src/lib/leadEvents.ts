import { supabase } from "./supabase.js";
import type { LeadEvent, Platform } from "../types.js";

export interface RecordLeadEventInput {
  businessId: string;
  contentItemId?: string | null;
  postId?: string | null;
  platform?: Platform | null;
  source: LeadEvent["source"];
  externalRef?: string | null;
  amountCents?: number | null;
  occurredAt?: string;
}

/** Generic ingestion point for non-GBP lead/booking/revenue attribution
 * (Phase 3.1). This is what a future CRM/Stripe webhook handler would call
 * once that integration actually exists — there is no such webhook today. */
export async function recordLeadEvent(input: RecordLeadEventInput): Promise<void> {
  const { error } = await supabase.from("lead_event").insert({
    business_id: input.businessId,
    content_item_id: input.contentItemId ?? null,
    post_id: input.postId ?? null,
    platform: input.platform ?? null,
    source: input.source,
    external_ref: input.externalRef ?? null,
    amount_cents: input.amountCents ?? null,
    occurred_at: input.occurredAt ?? new Date().toISOString(),
  });
  if (error) throw error;
}

export async function getLeadEventsForBusiness(businessId: string, sinceISO: string): Promise<LeadEvent[]> {
  const { data, error } = await supabase
    .from("lead_event")
    .select("*")
    .eq("business_id", businessId)
    .gte("occurred_at", sinceISO);
  if (error) throw error;
  return (data ?? []) as LeadEvent[];
}

/**
 * Example stub — NOT a real webhook listener. Shows the intended call shape
 * for a future inbound-call-tracking integration (e.g. a call-tracking
 * number per post/content_item) once that integration is confirmed to
 * exist. Calling this today is a no-op beyond the insert itself; there is
 * no call-tracking provider wired up.
 */
export async function recordCallEvent(
  businessId: string,
  contentItemId: string | null,
  callerNumber: string
): Promise<void> {
  await recordLeadEvent({
    businessId,
    contentItemId,
    source: "call",
    externalRef: callerNumber,
  });
}

/**
 * Example stub — NOT a real webhook listener. Shows the intended call shape
 * for a future form-submission integration (e.g. a landing page or Reach/CRM
 * form tied to a UTM-tagged link's utm_content value) once that integration
 * is confirmed to exist.
 */
export async function recordFormEvent(
  businessId: string,
  contentItemId: string | null,
  formSubmissionId: string
): Promise<void> {
  await recordLeadEvent({
    businessId,
    contentItemId,
    source: "form",
    externalRef: formSubmissionId,
  });
}
