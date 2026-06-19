import { supabase } from "../lib/supabase.js";
import { generateAdCreative } from "../ads/creative.js";
import { launchMetaCampaign } from "../ads/metaAds.js";
import { launchGoogleCampaign } from "../ads/googleAds.js";
import { getOrganizationForBusiness, resolveBusinessSetting } from "../lib/orgSettings.js";
import { canAutoBoost } from "../lib/boostPolicy.js";
import { logAgentAction } from "../lib/agentAction.js";
import type { Business, BoostTrigger, Post } from "../types.js";

/** Default boost spend until businesses can configure their own budget. */
const DEFAULT_BUDGET_CENTS = 2000;

/** Phase 3.3 guardrailed activation: an owner-specified budget in a BOOST
 * YES reply (e.g. "BOOST YES $50") is clamped to at most 5x the business's
 * configured/default budget, so a typo (e.g. an extra zero) can't authorize
 * an absurd spend without a second confirmation step. */
const MAX_BUDGET_MULTIPLIER = 5;

/** Resolves the boost_trigger rows for a business still awaiting an owner reply. */
export async function getPendingBoostTriggers(businessId: string): Promise<BoostTrigger[]> {
  const { data: posts, error } = await supabase
    .from("post")
    .select("id, content_item:content_item_id(business_id)")
    .returns<{ id: string; content_item: { business_id: string } | null }[]>();
  if (error) throw error;

  const postIds = (posts ?? []).filter((p) => p.content_item?.business_id === businessId).map((p) => p.id);
  if (postIds.length === 0) return [];

  const { data: pending, error: pendingError } = await supabase
    .from("boost_trigger")
    .select("*")
    .in("post_id", postIds)
    .is("responded_at", null);
  if (pendingError) throw pendingError;

  return (pending ?? []) as BoostTrigger[];
}

/** True if the business has at least one boost_trigger awaiting an owner reply. */
export async function hasPendingBoost(businessId: string): Promise<boolean> {
  return (await getPendingBoostTriggers(businessId)).length > 0;
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

type PostWithContentItem = Post & { content_item: { business_id: string; caption: string; caption_variant_b: string | null } | null };

async function fetchBusinessPosts(businessId: string): Promise<PostWithContentItem[]> {
  const { data: posts, error } = await supabase
    .from("post")
    .select("*, content_item:content_item_id(business_id, caption, caption_variant_b)")
    .returns<PostWithContentItem[]>();
  if (error) throw error;
  return (posts ?? []).filter((p) => p.content_item?.business_id === businessId);
}

/** Phase 8.1: the boost_trigger may point at the winning "b" post when a
 * staggered A/B test ran — boost the caption that actually won, not
 * always the "a" variant's text. */
function captionFor(post: PostWithContentItem | undefined): string {
  return (post?.variant === "b" ? post?.content_item?.caption_variant_b : post?.content_item?.caption) ?? "";
}

/** Resolves the default per-boost budget (business/org setting, or the
 * hardcoded fallback) and clamps an owner-specified override against it. */
export async function resolveBudgetCents(business: Business, requestedBudgetCents: number | null): Promise<number> {
  const organization = await getOrganizationForBusiness(business);
  const defaultBudgetCents = resolveBusinessSetting(business, organization, "boost_budget_cents", DEFAULT_BUDGET_CENTS);
  return requestedBudgetCents ? clampBudget(requestedBudgetCents, defaultBudgetCents) : defaultBudgetCents;
}

/** Generates ad creative from `caption` and launches it on `trigger`'s ad
 * platform, then records the result on the boost_trigger row. Shared by
 * the owner-approved path (handleBoostReply) and the Phase 8.2 auto-boost
 * path (trigger-engine), so both record the launch identically. */
export async function launchBoost(business: Business, trigger: BoostTrigger, caption: string, budgetCents: number): Promise<void> {
  const creative = await generateAdCreative(business, caption);
  const result =
    trigger.ad_platform === "google"
      ? await launchGoogleCampaign(business, creative, budgetCents)
      : await launchMetaCampaign(business, creative, budgetCents);

  await supabase
    .from("boost_trigger")
    .update({ ad_campaign_id: result.campaignId, budget_cents: budgetCents })
    .eq("id", trigger.id);

  // Phase 8.9: parallel audit-trail entry — the launch above already
  // happened by this point regardless of whether this write succeeds.
  await logAgentAction({
    businessId: business.id,
    source: trigger.owner_response === "auto" ? "performance_trigger" : "owner_message",
    intent: "launch_boost",
    tool: "launch_boost",
    input: { boostTriggerId: trigger.id, adPlatform: trigger.ad_platform, budgetCents },
    output: { campaignId: result.campaignId },
    status: "completed",
    riskLevel: "high",
    approvalRequired: trigger.owner_response !== "auto",
    ownerResponse: trigger.owner_response,
  });
}

/** Phase 8.2: attempts to launch a boost immediately, without an owner
 * approval round-trip, when the business's configured policy allows it.
 * Returns true if it launched; false (the common case — no policy
 * configured) means the caller should fall back to asking the owner. */
export async function tryAutoBoost(business: Business, trigger: BoostTrigger, post: Post): Promise<boolean> {
  if (!trigger.ad_platform) return false;

  const budgetCents = await resolveBudgetCents(business, null);
  const decision = await canAutoBoost(business, post, budgetCents);
  if (!decision.allowed) return false;

  const posts = await fetchBusinessPosts(business.id);
  const caption = captionFor(posts.find((p) => p.id === trigger.post_id));
  if (!caption) return false;

  // Mark the trigger as auto-resolved before launching so a concurrent
  // owner reply (a race, not the common case) can't double-launch the boost.
  await supabase
    .from("boost_trigger")
    .update({ owner_response: "auto", responded_at: new Date().toISOString(), handed_off_to_marketing: true })
    .eq("id", trigger.id);

  await launchBoost(business, { ...trigger, owner_response: "auto" }, caption, budgetCents);
  return true;
}

/** Handles an inbound BOOST YES/NO reply: launches the ad on approval, marks declined otherwise. */
export async function handleBoostReply(business: Business, body: string): Promise<void> {
  const { decision, budgetCents: requestedBudgetCents } = parseBoostReply(body);
  if (decision === "unknown") return;

  const posts = await fetchBusinessPosts(business.id);
  const businessPostIds = posts.map((p) => p.id);

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

  const caption = captionFor(posts.find((p) => p.id === trigger.post_id));
  const budgetCents = await resolveBudgetCents(business, requestedBudgetCents);
  await launchBoost(business, trigger, caption, budgetCents);
}
