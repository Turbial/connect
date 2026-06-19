import { supabase } from "../lib/supabase.js";
import { sendApprovalWhatsapp, boostButtons } from "../approval/whatsapp.js";
import { sendApprovalSms } from "../approval/sms.js";
import { sendApprovalEmail } from "../approval/email.js";
import { getOrganizationForBusiness, orgDisplayName, resolveBusinessSetting } from "../lib/orgSettings.js";
import { hasFeature } from "../lib/packages.js";
import { tryAutoBoost } from "../approval/boost.js";
import { statusOf } from "../lib/platformStatus.js";
import { logAgentAction } from "../lib/agentAction.js";
import type { AdPlatform, Business, BoostTrigger, Organization, Post } from "../types.js";

/** A post earns a boost prompt once it clears either threshold and has no existing boost_trigger. */
const VIEWS_THRESHOLD = 500;
const ENGAGEMENT_THRESHOLD = 50;

function pickAdPlatform(business: Business): AdPlatform | null {
  if (business.meta_ads_account_id) return "meta";
  if (business.google_ads_customer_id) return "google";
  return null;
}

function meetsThreshold(business: Business, organization: Organization | null, post: Post): boolean {
  const viewsThreshold = resolveBusinessSetting(business, organization, "boost_views_threshold", VIEWS_THRESHOLD);
  const engagementThreshold = resolveBusinessSetting(business, organization, "boost_engagement_threshold", ENGAGEMENT_THRESHOLD);
  return post.views >= viewsThreshold || post.engagement >= engagementThreshold;
}

/** Phase 8.1: cites the real measured engagement difference between a
 * content item's two staggered organic posts, per the doc's example ("We
 * tested two versions. Version B got 42% more engagement.") — only ever
 * called when a measured "b" post actually exists, never fabricated. */
export function buildComparisonMessage(postA: Post, postB: Post, captionA: string, captionB: string): string {
  const winnerIsB = postB.engagement > postA.engagement;
  const winner = winnerIsB ? postB : postA;
  const loserEngagement = winnerIsB ? postA.engagement : postB.engagement;
  const winnerCaption = winnerIsB ? captionB : captionA;
  const pctDiff = loserEngagement > 0 ? Math.round(((winner.engagement - loserEngagement) / loserEngagement) * 100) : 100;

  return [
    `We tested two versions of "${winnerCaption.slice(0, 60)}". Version ${winnerIsB ? "B" : "A"} got ${pctDiff}% more engagement (${winner.views} views, ${winner.engagement} engagement).`,
    `Want to boost it to reach more people? Reply BOOST YES or BOOST NO.`,
  ].join(" ");
}

/** Scans a business's posted content for organic performance that clears the boost threshold,
 * and prompts the owner to approve turning it into a paid ad. */
export async function evaluateBoostTriggers(business: Business): Promise<void> {
  if (!hasFeature(business, "boost_proposals")) return;

  const adPlatform = pickAdPlatform(business);
  if (!adPlatform) return;

  const organization = await getOrganizationForBusiness(business);

  const { data: itemIds, error: itemsError } = await supabase
    .from("content_item")
    .select("id, caption, caption_variant_b")
    .eq("business_id", business.id);
  if (itemsError) throw itemsError;

  const captionByItemId = new Map((itemIds ?? []).map((i) => [i.id, i.caption as string]));
  const captionBByItemId = new Map((itemIds ?? []).map((i) => [i.id, i.caption_variant_b as string | null]));

  const { data: posts, error } = await supabase
    .from("post")
    .select("*")
    .in("content_item_id", (itemIds ?? []).map((i) => i.id));
  if (error) throw error;
  const allPosts = (posts ?? []) as Post[];

  const { data: existingTriggers, error: triggerError } = await supabase
    .from("boost_trigger")
    .select("post_id");
  if (triggerError) throw triggerError;
  const triggeredPostIds = new Set((existingTriggers ?? []).map((t) => t.post_id));

  // Only "a" variants are scanned for trigger eligibility — a "b" variant
  // (Phase 8.1) is a comparison data point for its sibling "a" post, not an
  // independent boost candidate of its own. Phase 8.2: a stub/sandbox
  // platform's synthetic metrics can never trigger or justify a boost.
  for (const post of allPosts.filter((p) => p.variant === "a" && statusOf(p.platform) === "verified")) {
    if (triggeredPostIds.has(post.id) || !meetsThreshold(business, organization, post)) continue;

    // Phase 8.1: where a sibling "b" post exists and has been measured (its
    // performance poll has run at least once), cite the real comparison
    // rather than proposing the boost on a single untested variant.
    const variantB = allPosts.find(
      (p) => p.content_item_id === post.content_item_id && p.platform === post.platform && p.variant === "b" && p.last_polled_at
    );

    const winner = variantB && variantB.engagement > post.engagement ? variantB : post;
    const { data: insertedTrigger, error: insertError } = await supabase
      .from("boost_trigger")
      .insert({ post_id: winner.id, ad_platform: adPlatform })
      .select()
      .single();
    if (insertError) throw insertError;

    // Phase 8.9: parallel audit-trail entry — does not gate the trigger
    // insert above or the auto-boost/manual-approval decision below.
    await logAgentAction({
      businessId: business.id,
      source: "performance_trigger",
      intent: "propose_boost",
      tool: "propose_boost",
      input: { postId: winner.id, adPlatform },
      output: { boostTriggerId: insertedTrigger.id },
      status: "pending",
      riskLevel: "medium",
      approvalRequired: true,
    });

    // Phase 8.2: a configured policy can launch the boost immediately,
    // without an owner approval round-trip — skip sending the proposal
    // message entirely in that case. A business with no policy configured
    // always falls through to the message below, exactly as today.
    if (await tryAutoBoost(business, insertedTrigger as BoostTrigger, winner)) continue;

    const caption = captionByItemId.get(post.content_item_id) ?? "your recent post";
    const message = variantB
      ? buildComparisonMessage(post, variantB, caption, captionBByItemId.get(post.content_item_id) ?? caption)
      : [
          `Great news — "${caption.slice(0, 80)}" is performing well (${post.views} views, ${post.engagement} engagement).`,
          `Want to turn it into a paid ad to reach more people? Reply BOOST YES or BOOST NO.`,
        ].join(" ");

    if (business.owner_preferred_channel === "whatsapp" && (business.owner_mobile || business.owner_phone)) {
      await sendApprovalWhatsapp(business.owner_mobile ?? business.owner_phone!, message, {
        buttons: boostButtons(),
        phoneNumberIdOverride: organization?.whatsapp_phone_number_id ?? null,
      });
    } else if (business.owner_phone) {
      await sendApprovalSms(business.owner_phone, message, organization?.twilio_from_number ?? null);
    } else if (business.owner_email) {
      await sendApprovalEmail(business.owner_email, `Boost this post? — ${orgDisplayName(organization)}`, message);
    }
  }
}
