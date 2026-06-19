import { supabase } from "../lib/supabase.js";
import { postToGbp } from "./gbp.js";
import { postToFacebookPage, postToInstagram } from "./meta.js";
import { postToPinterest } from "./pinterest.js";
import { postToTwitter } from "./twitter.js";
import { postToLinkedin } from "./linkedin.js";
import { postToThreads } from "./threads.js";
import { postToYelp } from "./yelp.js";
import { postToNextdoor } from "./nextdoor.js";
import { postToSnapchat } from "./snapchat.js";
import { postToTiktok } from "./tiktok.js";
import { postToYoutube } from "./youtube.js";
import { postToWhatsapp } from "./whatsapp.js";
import { postToReddit } from "./reddit.js";
import { postToBluesky } from "./bluesky.js";
import { postToMastodon } from "./mastodon.js";
import { postToTumblr } from "./tumblr.js";
import { postToWechat } from "./wechat.js";
import { postToTelegram } from "./telegram.js";
import { postToDiscord } from "./discord.js";
import { postToMedium } from "./medium.js";
import { postToVk } from "./vk.js";
import { postToLine } from "./line.js";
import { postToVimeo } from "./vimeo.js";
import { postToFlickr } from "./flickr.js";
import { postToFoursquare } from "./foursquare.js";
import { postToBing } from "./bing.js";
import { postToApplebusiness } from "./applebusiness.js";
import { postToHouzz } from "./houzz.js";
import { postToAngi } from "./angi.js";
import { postToThumbtack } from "./thumbtack.js";
import { postToTripadvisor } from "./tripadvisor.js";
import { postToOpentable } from "./opentable.js";
import { postToQuora } from "./quora.js";
import { postToTrustpilot } from "./trustpilot.js";
import { postToYandex } from "./yandex.js";
import { genericAdapters } from "./genericAdapter.js";
import { isLivePlatform } from "../lib/platformStatus.js";
import { withRetry } from "../lib/retry.js";
import { logAgentAction } from "../lib/agentAction.js";
import type { Business, ContentItem, Platform, Post } from "../types.js";

async function postToPlatform(business: Business, item: ContentItem, platform: Platform) {
  if (platform === "gbp") return postToGbp(business, item);
  if (platform === "facebook") return postToFacebookPage(business, item);
  if (platform === "instagram") return postToInstagram(business, item);
  if (platform === "pinterest") return postToPinterest(business, item);
  if (platform === "twitter") return postToTwitter(business, item);
  if (platform === "linkedin") return postToLinkedin(business, item);
  if (platform === "threads") return postToThreads(business, item);
  if (platform === "yelp") return postToYelp(business, item);
  if (platform === "nextdoor") return postToNextdoor(business, item);
  if (platform === "snapchat") return postToSnapchat(business, item);
  if (platform === "tiktok") return postToTiktok(business, item);
  if (platform === "youtube") return postToYoutube(business, item);
  if (platform === "whatsapp") return postToWhatsapp(business, item);
  if (platform === "reddit") return postToReddit(business, item);
  if (platform === "bluesky") return postToBluesky(business, item);
  if (platform === "mastodon") return postToMastodon(business, item);
  if (platform === "tumblr") return postToTumblr(business, item);
  if (platform === "wechat") return postToWechat(business, item);
  if (platform === "telegram") return postToTelegram(business, item);
  if (platform === "discord") return postToDiscord(business, item);
  if (platform === "medium") return postToMedium(business, item);
  if (platform === "vk") return postToVk(business, item);
  if (platform === "line") return postToLine(business, item);
  if (platform === "vimeo") return postToVimeo(business, item);
  if (platform === "flickr") return postToFlickr(business, item);
  if (platform === "foursquare") return postToFoursquare(business, item);
  if (platform === "bing") return postToBing(business, item);
  if (platform === "applebusiness") return postToApplebusiness(business, item);
  if (platform === "houzz") return postToHouzz(business, item);
  if (platform === "angi") return postToAngi(business, item);
  if (platform === "thumbtack") return postToThumbtack(business, item);
  if (platform === "tripadvisor") return postToTripadvisor(business, item);
  if (platform === "opentable") return postToOpentable(business, item);
  if (platform === "quora") return postToQuora(business, item);
  if (platform === "trustpilot") return postToTrustpilot(business, item);
  if (platform === "yandex") return postToYandex(business, item);
  const generic = genericAdapters[platform];
  if (generic) return generic.postTo(business, item);
  throw new Error(`Unsupported platform: ${platform}`);
}

async function recordPost(
  business: Business,
  item: ContentItem,
  platform: Platform,
  variant: "a" | "b",
  postFn: () => ReturnType<typeof postToPlatform>
): Promise<void> {
  try {
    const result = await withRetry(postFn);

    // Idempotent on (content_item_id, platform, variant): a retried dispatch
    // for a variant that already posted to this platform is a no-op, not a
    // duplicate live post.
    const { error: postError } = await supabase
      .from("post")
      .upsert(
        {
          content_item_id: item.id,
          platform,
          variant,
          platform_post_id: result.platformPostId,
          posted_at: new Date().toISOString(),
          impressions: 0,
          shares: 0,
        },
        { onConflict: "content_item_id,platform,variant", ignoreDuplicates: true }
      );
    if (postError) throw postError;

    // Phase 8.9: parallel audit-trail entry only — this doesn't gate or
    // change the dispatch above, which already happened by this point.
    await logAgentAction({
      businessId: business.id,
      source: "weekly_job",
      intent: "publish_post",
      tool: "post_to_platform",
      input: { contentItemId: item.id, platform, variant },
      output: { platformPostId: result.platformPostId },
      status: "completed",
      riskLevel: "low",
      approvalRequired: false,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await supabase.from("distribution_failure").insert({
      business_id: business.id,
      content_item_id: item.id,
      platform,
      error: message,
    });

    await logAgentAction({
      businessId: business.id,
      source: "weekly_job",
      intent: "publish_post",
      tool: "post_to_platform",
      input: { contentItemId: item.id, platform, variant },
      status: "failed",
      riskLevel: "low",
      approvalRequired: false,
      error: message,
    });
  }
}

/** Posts every approved content item for a business to its target platforms. */
export async function postApprovedContent(business: Business): Promise<void> {
  const { data: items, error } = await supabase
    .from("content_item")
    .select("*")
    .eq("business_id", business.id)
    .eq("status", "approved");
  if (error) throw error;

  for (const item of (items ?? []) as ContentItem[]) {
    for (const platform of item.platforms) {
      if (!isLivePlatform(platform)) {
        // Stub/unsupported platforms don't post anywhere real — skip
        // dispatch entirely rather than record a post that never happened.
        continue;
      }

      await recordPost(business, item, platform, "a", () => postToPlatform(business, item, platform));
    }

    await supabase.from("content_item").update({ status: "posted" }).eq("id", item.id);
  }
}

/** Phase 8.1: hours to wait after the "a" variant goes live before posting
 * "b" as its own staggered post — long enough for the "a" variant to have
 * accrued some organic engagement of its own to compare against. */
const VARIANT_B_STAGGER_HOURS = 24;

/** Posts a content item's caption_variant_b as a second, separately
 * trackable post once its "a" variant has had time to accrue organic
 * engagement — real staggered A/B testing where the platform/posting flow
 * allows it. Items with no distinct caption_variant_b are untouched, so
 * they fall back to today's single-variant flow exactly as before. */
export async function postVariantBIfDue(business: Business): Promise<void> {
  const { data: items, error } = await supabase
    .from("content_item")
    .select("*")
    .eq("business_id", business.id)
    .eq("status", "posted")
    .not("caption_variant_b", "is", null);
  if (error) throw error;

  const candidates = (items ?? []).filter((i) => i.caption_variant_b && i.caption_variant_b !== i.caption) as ContentItem[];
  if (candidates.length === 0) return;

  const { data: posts, error: postsError } = await supabase
    .from("post")
    .select("*")
    .in("content_item_id", candidates.map((i) => i.id));
  if (postsError) throw postsError;
  const typedPosts = (posts ?? []) as Post[];

  const staggerCutoff = Date.now() - VARIANT_B_STAGGER_HOURS * 60 * 60 * 1000;

  for (const item of candidates) {
    const itemPosts = typedPosts.filter((p) => p.content_item_id === item.id);

    for (const platform of item.platforms) {
      if (!isLivePlatform(platform)) continue;

      const variantA = itemPosts.find((p) => p.platform === platform && p.variant === "a");
      if (!variantA?.posted_at || new Date(variantA.posted_at).getTime() > staggerCutoff) continue;

      const alreadyHasB = itemPosts.some((p) => p.platform === platform && p.variant === "b");
      if (alreadyHasB) continue;

      const variantBItem: ContentItem = { ...item, caption: item.caption_variant_b! };
      await recordPost(business, item, platform, "b", () => postToPlatform(business, variantBItem, platform));
    }
  }
}
