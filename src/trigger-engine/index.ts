import { supabase } from "../lib/supabase.js";
import { sendApprovalSms } from "../approval/sms.js";
import { sendApprovalEmail } from "../approval/email.js";
import type { AdPlatform, Business, Post } from "../types.js";

/** A post earns a boost prompt once it clears either threshold and has no existing boost_trigger. */
const VIEWS_THRESHOLD = 500;
const ENGAGEMENT_THRESHOLD = 50;

function pickAdPlatform(business: Business): AdPlatform | null {
  if (business.meta_ads_account_id) return "meta";
  if (business.google_ads_customer_id) return "google";
  return null;
}

function meetsThreshold(business: Business, post: Post): boolean {
  const viewsThreshold = business.boost_views_threshold ?? VIEWS_THRESHOLD;
  const engagementThreshold = business.boost_engagement_threshold ?? ENGAGEMENT_THRESHOLD;
  return post.views >= viewsThreshold || post.engagement >= engagementThreshold;
}

/** Scans a business's posted content for organic performance that clears the boost threshold,
 * and prompts the owner to approve turning it into a paid ad. */
export async function evaluateBoostTriggers(business: Business): Promise<void> {
  const adPlatform = pickAdPlatform(business);
  if (!adPlatform) return;

  const { data: itemIds, error: itemsError } = await supabase
    .from("content_item")
    .select("id, caption")
    .eq("business_id", business.id);
  if (itemsError) throw itemsError;

  const captionByItemId = new Map((itemIds ?? []).map((i) => [i.id, i.caption as string]));

  const { data: posts, error } = await supabase
    .from("post")
    .select("*")
    .in("content_item_id", (itemIds ?? []).map((i) => i.id));
  if (error) throw error;

  const { data: existingTriggers, error: triggerError } = await supabase
    .from("boost_trigger")
    .select("post_id");
  if (triggerError) throw triggerError;
  const triggeredPostIds = new Set((existingTriggers ?? []).map((t) => t.post_id));

  for (const post of (posts ?? []) as Post[]) {
    if (triggeredPostIds.has(post.id) || !meetsThreshold(business, post)) continue;

    const { error: insertError } = await supabase
      .from("boost_trigger")
      .insert({ post_id: post.id, ad_platform: adPlatform });
    if (insertError) throw insertError;

    const caption = captionByItemId.get(post.content_item_id) ?? "your recent post";
    const message = [
      `Great news — "${caption.slice(0, 80)}" is performing well (${post.views} views, ${post.engagement} engagement).`,
      `Want to turn it into a paid ad to reach more people? Reply BOOST YES or BOOST NO.`,
    ].join(" ");

    if (business.owner_phone) {
      await sendApprovalSms(business.owner_phone, message);
    } else if (business.owner_email) {
      await sendApprovalEmail(business.owner_email, "Boost this post?", message);
    }
  }
}
