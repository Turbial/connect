import { supabase } from "../lib/supabase.js";
import { generatePost, generateTrendingIdea } from "./generate.js";
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
  if (business.telegram_channel_id) platforms.push("telegram");
  if (business.discord_channel_id) platforms.push("discord");
  if (business.medium_publication_id) platforms.push("medium");
  if (business.vk_group_id) platforms.push("vk");
  if (business.line_channel_id) platforms.push("line");
  if (business.vimeo_user_id) platforms.push("vimeo");
  if (business.flickr_user_id) platforms.push("flickr");
  if (business.foursquare_venue_id) platforms.push("foursquare");
  if (business.bing_business_id) platforms.push("bing");
  if (business.applebusiness_location_id) platforms.push("applebusiness");
  if (business.houzz_business_id) platforms.push("houzz");
  if (business.angi_business_id) platforms.push("angi");
  if (business.thumbtack_business_id) platforms.push("thumbtack");
  if (business.tripadvisor_location_id) platforms.push("tripadvisor");
  if (business.opentable_restaurant_id) platforms.push("opentable");
  if (business.quora_space_id) platforms.push("quora");
  if (business.trustpilot_business_unit_id) platforms.push("trustpilot");
  if (business.yandex_business_id) platforms.push("yandex");
  if (business.weibo_id) platforms.push("weibo");
  if (business.xiaohongshu_id) platforms.push("xiaohongshu");
  if (business.kakaotalk_id) platforms.push("kakaotalk");
  if (business.naver_id) platforms.push("naver");
  if (business.baidu_id) platforms.push("baidu");
  if (business.douyin_id) platforms.push("douyin");
  if (business.kuaishou_id) platforms.push("kuaishou");
  if (business.weverse_id) platforms.push("weverse");
  if (business.signal_id) platforms.push("signal");
  if (business.viber_id) platforms.push("viber");
  if (business.kik_id) platforms.push("kik");
  if (business.skype_id) platforms.push("skype");
  if (business.slack_id) platforms.push("slack");
  if (business.meetup_id) platforms.push("meetup");
  if (business.eventbrite_id) platforms.push("eventbrite");
  if (business.craigslist_id) platforms.push("craigslist");
  if (business.indeed_id) platforms.push("indeed");
  if (business.glassdoor_id) platforms.push("glassdoor");
  if (business.capterra_id) platforms.push("capterra");
  if (business.g2_id) platforms.push("g2");
  if (business.producthunt_id) platforms.push("producthunt");
  if (business.behance_id) platforms.push("behance");
  if (business.dribbble_id) platforms.push("dribbble");
  if (business.deviantart_id) platforms.push("deviantart");
  if (business.fivehundredpx_id) platforms.push("fivehundredpx");
  if (business.unsplash_id) platforms.push("unsplash");
  if (business.soundcloud_id) platforms.push("soundcloud");
  if (business.spotify_id) platforms.push("spotify");
  if (business.applepodcasts_id) platforms.push("applepodcasts");
  if (business.googlepodcasts_id) platforms.push("googlepodcasts");
  if (business.anchor_id) platforms.push("anchor");
  if (business.substack_id) platforms.push("substack");
  if (business.ghost_id) platforms.push("ghost");
  if (business.wordpress_id) platforms.push("wordpress");
  if (business.blogger_id) platforms.push("blogger");
  if (business.weebly_id) platforms.push("weebly");
  if (business.wix_id) platforms.push("wix");
  if (business.squarespace_id) platforms.push("squarespace");
  if (business.etsy_id) platforms.push("etsy");
  if (business.amazon_id) platforms.push("amazon");
  if (business.shopify_id) platforms.push("shopify");
  if (business.walmart_id) platforms.push("walmart");
  if (business.target_id) platforms.push("target");
  if (business.instacart_id) platforms.push("instacart");
  if (business.doordash_id) platforms.push("doordash");
  if (business.ubereats_id) platforms.push("ubereats");
  if (business.grubhub_id) platforms.push("grubhub");
  if (business.postmates_id) platforms.push("postmates");
  if (business.zomato_id) platforms.push("zomato");
  if (business.swiggy_id) platforms.push("swiggy");
  if (business.justeat_id) platforms.push("justeat");
  if (business.deliveroo_id) platforms.push("deliveroo");
  if (business.booking_id) platforms.push("booking");
  if (business.expedia_id) platforms.push("expedia");
  if (business.airbnb_id) platforms.push("airbnb");
  if (business.vrbo_id) platforms.push("vrbo");
  if (business.hotelscom_id) platforms.push("hotelscom");
  if (business.kayak_id) platforms.push("kayak");
  if (business.agoda_id) platforms.push("agoda");
  if (business.trivago_id) platforms.push("trivago");
  if (business.hostelworld_id) platforms.push("hostelworld");
  if (business.couchsurfing_id) platforms.push("couchsurfing");
  if (business.meituan_id) platforms.push("meituan");
  if (business.dianping_id) platforms.push("dianping");
  if (business.gaode_id) platforms.push("gaode");
  if (business.here_id) platforms.push("here");
  if (business.mapquest_id) platforms.push("mapquest");
  if (business.waze_id) platforms.push("waze");
  if (business.alibaba_id) platforms.push("alibaba");
  if (business.tmall_id) platforms.push("tmall");
  if (business.ebay_id) platforms.push("ebay");
  if (business.naverblog_id) platforms.push("naverblog");
  return platforms;
}

/**
 * Generates Phase 1's weekly batch (2-4 ideas) and queues one content_item per
 * connected platform per idea, with platform-tailored copy (Phase 2).
 */
export async function queueWeeklyContent(business: Business, count = 3): Promise<void> {
  const platforms = connectedPlatforms(business);
  const trendingIdea = (await generateTrendingIdea(business)) ?? undefined;

  for (let i = 0; i < count; i++) {
    for (const platform of platforms) {
      const { caption, captionVariantB, mediaUrl, mediaType, altText } = await generatePost(business, platform, trendingIdea);

      const { error } = await supabase.from("content_item").insert({
        business_id: business.id,
        source: "content_engine",
        caption,
        caption_variant_b: captionVariantB,
        media_url: mediaUrl,
        media_type: mediaType,
        alt_text: altText,
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
    const { caption, captionVariantB, mediaUrl, mediaType, altText } = await generatePost(business, platform, brief, reviewRating);

    const { error } = await supabase.from("content_item").insert({
      business_id: business.id,
      source: "review_triggered",
      caption,
      caption_variant_b: captionVariantB,
      media_url: mediaUrl,
      media_type: mediaType,
      alt_text: altText,
      platforms: [platform],
      status: "queued",
      review_id: reviewId,
    });

    if (error) throw error;
  }
}
