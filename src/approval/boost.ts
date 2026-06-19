import { supabase } from "../lib/supabase.js";
import { generateAdCreative } from "../ads/creative.js";
import { launchMetaCampaign } from "../ads/metaAds.js";
import { launchGoogleCampaign } from "../ads/googleAds.js";
import { getOrganizationForBusiness, resolveBusinessSetting } from "../lib/orgSettings.js";
import type { Business, BoostTrigger, Post } from "../types.js";

/** Default boost spend until businesses can configure their own budget. */
const DEFAULT_BUDGET_CENTS = 2000;

/** Phase 3.3 guardrailed activation: an owner-specified budget in a BOOST
 * YES reply (e.g. "BOOST YES $50") is clamped to at most 5x the business's
 * configured/default budget, so a typo (e.g. an extra zero) can't authorize
 * an absurd spend without a second confirmation step. */
const MAX_BUDGET_MULTIPLIER = 5;

/** True if the business has at least one boost_trigger awaiting an owner reply. */
export async function hasPendingBoost(businessId: string): Promise<boolean> {
  const { data: posts, error } = await supabase
    .from("post")
    .select("id, content_item:content_item_id(business_id)")
    .returns<{ id: string; content_item: { business_id: string } | null }[]>();
  if (error) throw error;

  const postIds = (posts ?? []).filter((p) => p.content_item?.business_id === businessId).map((p) => p.id);
  if (postIds.length === 0) return false;

  const { data: pending, error: pendingError } = await supabase
    .from("boost_trigger")
    .select("id")
    .in("post_id", postIds)
    .is("responded_at", null);
  if (pendingError) throw pendingError;

  return (pending ?? []).length > 0;
}

interface BoostReply {
  decision: "yes" | "no" | "unknown";
  /** Owner-specified budget in cents, parsed from a trailing dollar amount
   * (e.g. "BOOST YES $50"). Null when no amount was given — callers fall
   * back to the business/default budget in that case. */
  budgetCents: number | null;
}

export function parseBoostReply(body: string): BoostReply {
  const normalized = body.trim().toLowerCase().replace(/^boost\s*/, "");
  const amountMatch = normalized.match(/\$?(\d+(?:\.\d{1,2})?)/);
  const budgetCents = amountMatch ? Math.round(parseFloat(amountMatch[1]) * 100) : null;

  // Word-boundary anchored, not a plain startsWith — otherwise unrelated replies like
  // "Nothing, thanks" or "November news" (which start with "no") would be misread as a decline.
  if (/^(yes|y)\b/.test(normalized)) return { decision: "yes", budgetCents };
  if (/^(no|n)\b/.test(normalized)) return { decision: "no", budgetCents: null };
  return { decision: "unknown", budgetCents: null };
}

/** Clamps an owner-specified budget to a sane ceiling relative to the
 * business's configured/default budget, so a typo can't authorize an
 * absurd spend (Phase 3.3 guardrailed activation). */
export function clampBudget(requestedCents: number, ceilingBaseCents: number): number {
  const maxCents = ceilingBaseCents * MAX_BUDGET_MULTIPLIER;
  return Math.min(requestedCents, maxCents);
}

/** Handles an inbound BOOST YES/NO reply: launches the ad on approval, marks declined otherwise. */
export async function handleBoostReply(business: Business, body: string): Promise<void> {
  const { decision, budgetCents: requestedBudgetCents } = parseBoostReply(body);
  if (decision === "unknown") return;

  const { data: posts, error: postsError } = await supabase
    .from("post")
    .select("*, content_item:content_item_id(business_id, caption, caption_variant_b)")
    .returns<(Post & { content_item: { business_id: string; caption: string; caption_variant_b: string | null } | null })[]>();
  if (postsError) throw postsError;

  const businessPostIds = (posts ?? [])
    .filter((p) => p.content_item?.business_id === business.id)
    .map((p) => p.id);

  const { data: pending, error: triggerError } = await supabase
    .from("boost_trigger")
    .select("*")
    .in("post_id", businessPostIds)
    .is("responded_at", null)
    .order("threshold_met_at", { ascending: true })
    .limit(1);
  if (triggerError) throw triggerError;

  const trigger = (pending ?? [])[0] as BoostTrigger | undefined;
  if (!trigger) return;

  await supabase
    .from("boost_trigger")
    .update({
      owner_response: decision,
      responded_at: new Date().toISOString(),
      handed_off_to_marketing: decision === "yes",
    })
    .eq("id", trigger.id);

  if (decision !== "yes") return;

  const post = (posts ?? []).find((p) => p.id === trigger.post_id);
  // Phase 8.1: the boost_trigger may point at the winning "b" post when a
  // staggered A/B test ran — boost the caption that actually won, not
  // always the "a" variant's text.
  const caption = (post?.variant === "b" ? post.content_item?.caption_variant_b : post?.content_item?.caption) ?? "";

  const organization = await getOrganizationForBusiness(business);
  const defaultBudgetCents = resolveBusinessSetting(business, organization, "boost_budget_cents", DEFAULT_BUDGET_CENTS);
  const budgetCents = requestedBudgetCents ? clampBudget(requestedBudgetCents, defaultBudgetCents) : defaultBudgetCents;
  const creative = await generateAdCreative(business, caption);
  const result =
    trigger.ad_platform === "google"
      ? await launchGoogleCampaign(business, creative, budgetCents)
      : await launchMetaCampaign(business, creative, budgetCents);

  await supabase
    .from("boost_trigger")
    .update({ ad_campaign_id: result.campaignId, budget_cents: budgetCents })
    .eq("id", trigger.id);
}
