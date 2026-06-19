import { supabase } from "./supabase.js";
import { statusOf } from "./platformStatus.js";
import type { Business, BoostTrigger, Post } from "../types.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

/** Sum of `budget_cents` for boosts this business already launched
 * (`ad_campaign_id` set) within the given lookback window. */
async function spendSince(businessPostIds: string[], sinceMs: number): Promise<number> {
  if (businessPostIds.length === 0) return 0;

  const { data, error } = await supabase
    .from("boost_trigger")
    .select("*")
    .in("post_id", businessPostIds)
    .not("ad_campaign_id", "is", null)
    .gte("responded_at", new Date(sinceMs).toISOString());
  if (error) throw error;

  return ((data ?? []) as BoostTrigger[]).reduce((sum, t) => sum + (t.budget_cents ?? 0), 0);
}

export interface AutoBoostDecision {
  allowed: boolean;
  /** Present only when allowed is false — why the auto-boost path didn't apply. */
  reason?: string;
}

/** Phase 8.2: whether a boost for `post` at `proposedBudgetCents` can launch
 * without an owner approval round-trip. A business with no policy
 * configured (auto_boost_threshold_cents unset) always returns not-allowed,
 * so it behaves exactly as today. The existing hard 5x clampBudget ceiling
 * is enforced separately by the caller — this only decides whether to skip
 * asking, never whether to exceed the hard cap. */
export async function canAutoBoost(business: Business, post: Post, proposedBudgetCents: number): Promise<AutoBoostDecision> {
  if (business.auto_boost_threshold_cents == null) return { allowed: false, reason: "no auto-boost policy configured" };

  // Phase 8.1/8.2: synthetic metrics from a stub/sandbox platform can never
  // justify an autonomous spend decision — only a verified adapter's real
  // numbers can.
  if (statusOf(post.platform) !== "verified") {
    return { allowed: false, reason: `${post.platform} is not a verified platform` };
  }

  if (business.boost_allowed_platforms && !business.boost_allowed_platforms.includes(post.platform)) {
    return { allowed: false, reason: `${post.platform} is not in boost_allowed_platforms` };
  }

  if (proposedBudgetCents > business.auto_boost_threshold_cents) {
    return { allowed: false, reason: "proposed budget exceeds auto_boost_threshold_cents" };
  }

  if (business.manual_approval_threshold_cents != null && proposedBudgetCents > business.manual_approval_threshold_cents) {
    return { allowed: false, reason: "proposed budget exceeds manual_approval_threshold_cents" };
  }

  if (business.max_boost_per_post_cents != null && proposedBudgetCents > business.max_boost_per_post_cents) {
    return { allowed: false, reason: "proposed budget exceeds max_boost_per_post_cents" };
  }

  const { data: businessPosts, error } = await supabase
    .from("post")
    .select("id, content_item:content_item_id(business_id)")
    .returns<{ id: string; content_item: { business_id: string } | null }[]>();
  if (error) throw error;
  const businessPostIds = (businessPosts ?? []).filter((p) => p.content_item?.business_id === business.id).map((p) => p.id);

  if (business.boost_stop_loss_cents != null) {
    const allTimeSpend = await spendSince(businessPostIds, 0);
    if (allTimeSpend >= business.boost_stop_loss_cents) {
      return { allowed: false, reason: "boost_stop_loss_cents reached" };
    }
  }

  if (business.max_daily_boost_spend_cents != null) {
    const dailySpend = await spendSince(businessPostIds, Date.now() - DAY_MS);
    if (dailySpend + proposedBudgetCents > business.max_daily_boost_spend_cents) {
      return { allowed: false, reason: "would exceed max_daily_boost_spend_cents" };
    }
  }

  if (business.max_weekly_boost_spend_cents != null) {
    const weeklySpend = await spendSince(businessPostIds, Date.now() - WEEK_MS);
    if (weeklySpend + proposedBudgetCents > business.max_weekly_boost_spend_cents) {
      return { allowed: false, reason: "would exceed max_weekly_boost_spend_cents" };
    }
  }

  return { allowed: true };
}
