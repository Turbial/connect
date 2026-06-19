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
import type { Business, ContentItem, Platform } from "../types.js";

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

      const result = await postToPlatform(business, item, platform);

      const { error: postError } = await supabase.from("post").insert({
        content_item_id: item.id,
        platform,
        platform_post_id: result.platformPostId,
        posted_at: new Date().toISOString(),
        impressions: 0,
        shares: 0,
      });
      if (postError) throw postError;
    }

    await supabase.from("content_item").update({ status: "posted" }).eq("id", item.id);
  }
}
