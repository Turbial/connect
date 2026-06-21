import { supabase } from "./supabase.js";
import type { BoostTrigger, LeadEvent, Post } from "../types.js";

export interface BoostReportEntry {
  platform: string;
  spentCents: number;
  clicks: number;
  engagement: number;
  /** Null when no lead_event ties back to this boost's post — never a
   * fabricated estimate; the report omits the leads/revenue line entirely
   * in that case. */
  leadCount: number | null;
  attributedRevenueCents: number | null;
}

export function buildBoostReportEntry(post: Post, trigger: BoostTrigger, leadEvents: LeadEvent[]): BoostReportEntry {
  const hasAttribution = leadEvents.length > 0;
  return {
    platform: post.platform,
    spentCents: trigger.budget_cents ?? 0,
    clicks: post.clicks,
    engagement: post.engagement,
    leadCount: hasAttribution ? leadEvents.length : null,
    attributedRevenueCents: hasAttribution ? leadEvents.reduce((sum, e) => sum + (e.amount_cents ?? 0), 0) : null,
  };
}

/** Phase 8.5: per-boost spend + attribution for the weekly digest. Only
 * boosts that actually launched (ad_campaign_id set) within the window are
 * included — a pending or declined boost_trigger has no spend to report. */
export async function getBoostPerformance(businessId: string, sinceISO: string): Promise<BoostReportEntry[]> {
  const { data: itemIds, error: itemsError } = await supabase.from("content_item").select("id").eq("business_id", businessId);
  if (itemsError) throw itemsError;

  const { data: posts, error: postsError } = await supabase
    .from("post")
    .select("*")
    .in("content_item_id", (itemIds ?? []).map((i) => i.id));
  if (postsError) throw postsError;
  const businessPosts = (posts ?? []) as Post[];

  const { data: triggers, error: triggersError } = await supabase
    .from("boost_trigger")
    .select("*")
    .in("post_id", businessPosts.map((p) => p.id))
    .not("ad_campaign_id", "is", null)
    .gte("responded_at", sinceISO);
  if (triggersError) throw triggersError;

  const postById = new Map(businessPosts.map((p) => [p.id, p]));
  const entries: BoostReportEntry[] = [];

  for (const trigger of (triggers ?? []) as BoostTrigger[]) {
    const post = postById.get(trigger.post_id);
    if (!post) continue;

    const { data: leadEvents, error: leadError } = await supabase.from("lead_event").select("*").eq("post_id", post.id);
    if (leadError) throw leadError;

    entries.push(buildBoostReportEntry(post, trigger, (leadEvents ?? []) as LeadEvent[]));
  }

  return entries;
}
