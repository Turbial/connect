import { supabase } from "../lib/supabase.js";
import { generatePost } from "./generate.js";
import type { Business, Platform } from "../types.js";

export function connectedPlatforms(business: Business): Platform[] {
  const platforms: Platform[] = ["gbp"]; // GBP is always assumed connected in Phase 1+
  if (business.fb_page_id) platforms.push("facebook");
  if (business.ig_business_id) platforms.push("instagram");
  if (business.pinterest_board_id) platforms.push("pinterest");
  if (business.twitter_access_token) platforms.push("twitter");
  if (business.linkedin_organization_id) platforms.push("linkedin");
  if (business.threads_user_id) platforms.push("threads");
  if (business.yelp_business_id) platforms.push("yelp");
  if (business.nextdoor_business_id) platforms.push("nextdoor");
  if (business.snapchat_profile_id) platforms.push("snapchat");
  if (business.tiktok_user_id) platforms.push("tiktok");
  if (business.youtube_channel_id) platforms.push("youtube");
  if (business.whatsapp_phone_number_id) platforms.push("whatsapp");
  if (business.reddit_subreddit) platforms.push("reddit");
  if (business.bluesky_handle) platforms.push("bluesky");
  if (business.mastodon_instance_url) platforms.push("mastodon");
  if (business.tumblr_blog_name) platforms.push("tumblr");
  if (business.wechat_official_account_id) platforms.push("wechat");
  return platforms;
}

/**
 * Generates Phase 1's weekly batch (2-4 ideas) and queues one content_item per
 * connected platform per idea, with platform-tailored copy (Phase 2).
 */
export async function queueWeeklyContent(business: Business, count = 3): Promise<void> {
  const platforms = connectedPlatforms(business);

  for (let i = 0; i < count; i++) {
    for (const platform of platforms) {
      const { caption, mediaUrl, mediaType } = await generatePost(business, platform);

      const { error } = await supabase.from("content_item").insert({
        business_id: business.id,
        source: "content_engine",
        caption,
        media_url: mediaUrl,
        media_type: mediaType,
        platforms: [platform],
        status: "queued",
      });

      if (error) throw error;
    }
  }
}

/** Phase 4: generates a single draft from a review and queues it across connected platforms.
 * reviewRating drives sentiment-aware tone adjustment in the Content Engine (Phase 9). */
export async function queueReviewTriggeredContent(
  business: Business,
  reviewId: string,
  brief: string,
  reviewRating?: number | null
): Promise<void> {
  const platforms = connectedPlatforms(business);

  for (const platform of platforms) {
    const { caption, mediaUrl, mediaType } = await generatePost(business, platform, brief, reviewRating);

    const { error } = await supabase.from("content_item").insert({
      business_id: business.id,
      source: "review_triggered",
      caption,
      media_url: mediaUrl,
      media_type: mediaType,
      platforms: [platform],
      status: "queued",
      review_id: reviewId,
    });

    if (error) throw error;
  }
}
