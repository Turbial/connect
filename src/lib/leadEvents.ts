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
 * (Phase 3.1). Called directly by the Stripe webhook and the generic
 * CRM/form/booking/call webhook handlers in src/index.ts. */
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

export interface RevenueByPlatformEntry {
  platform: Platform | "unattributed";
  leadCount: number;
  totalAmountCents: number;
}

/** Groups every lead/revenue event ever recorded for a business by the
 * platform it's attributed to, so an owner can see which platforms are
 * actually driving calls/bookings/revenue rather than just views — events
 * with no platform (e.g. a generic call-tracking number not tied to a
 * specific post) are grouped under "unattributed" rather than dropped. */
export async function getRevenueByPlatform(businessId: string): Promise<RevenueByPlatformEntry[]> {
  const { data, error } = await supabase.from("lead_event").select("*").eq("business_id", businessId);
  if (error) throw error;

  const byPlatform = new Map<Platform | "unattributed", { leadCount: number; totalAmountCents: number }>();
  for (const event of (data ?? []) as LeadEvent[]) {
    const key = event.platform ?? "unattributed";
    const existing = byPlatform.get(key) ?? { leadCount: 0, totalAmountCents: 0 };
    existing.leadCount += 1;
    existing.totalAmountCents += event.amount_cents ?? 0;
    byPlatform.set(key, existing);
  }

  return [...byPlatform.entries()]
    .map(([platform, totals]) => ({ platform, ...totals }))
    .sort((a, b) => b.totalAmountCents - a.totalAmountCents);
}
