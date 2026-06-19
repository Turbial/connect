import { supabase } from "../lib/supabase.js";
import { generateAdCreative } from "../ads/creative.js";
import { launchMetaCampaign } from "../ads/metaAds.js";
import { launchGoogleCampaign } from "../ads/googleAds.js";
import type { Business, BoostTrigger, Post } from "../types.js";

/** Default boost spend until businesses can configure their own budget. */
const DEFAULT_BUDGET_CENTS = 2000;

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

function parseBoostReply(body: string): "yes" | "no" | "unknown" {
  const normalized = body.trim().toLowerCase().replace(/^boost\s*/, "");
  if (normalized === "yes" || normalized === "y") return "yes";
  if (normalized === "no" || normalized === "n") return "no";
  return "unknown";
}

/** Handles an inbound BOOST YES/NO reply: launches the ad on approval, marks declined otherwise. */
export async function handleBoostReply(business: Business, body: string): Promise<void> {
  const decision = parseBoostReply(body);
  if (decision === "unknown") return;

  const { data: posts, error: postsError } = await supabase
    .from("post")
    .select("*, content_item:content_item_id(business_id, caption)")
    .returns<(Post & { content_item: { business_id: string; caption: string } | null })[]>();
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
  const caption = post?.content_item?.caption ?? "";

  const budgetCents = business.boost_budget_cents ?? DEFAULT_BUDGET_CENTS;
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
