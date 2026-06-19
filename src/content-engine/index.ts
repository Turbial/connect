import { supabase } from "../lib/supabase.js";
import { generatePost, generateTrendingIdea } from "./generate.js";
import { getConnection, upsertConnection } from "../lib/platformConnection.js";
import { statusOf } from "../lib/platformStatus.js";
import type { Business, Platform } from "../types.js";

/** The business-column value that identifies a connected account per platform,
 * used to sync platform_connection rows (Phase 2.1) without requiring every
 * adapter to be rewritten to read from platform_connection directly. */
function connectionAccountId(business: Business, platform: Platform): string | null {
  switch (platform) {
    case "gbp":
      return business.gbp_location_id ?? "gbp"; // GBP is always assumed connected in Phase 1+
    case "facebook":
      return business.fb_page_id;
    case "instagram":
      return business.ig_business_id;
    case "pinterest":
      return business.pinterest_board_id;
    case "twitter":
      return business.twitter_access_token ? "twitter" : null;
    case "linkedin":
      return business.linkedin_organization_id;
    case "threads":
      return business.threads_user_id;
    case "yelp":
      return business.yelp_business_id;
    case "nextdoor":
      return business.nextdoor_business_id;
    case "snapchat":
      return business.snapchat_profile_id;
    case "tiktok":
      return business.tiktok_user_id;
    case "youtube":
      return business.youtube_channel_id;
    case "whatsapp":
      return business.whatsapp_phone_number_id;
    case "reddit":
      return business.reddit_subreddit;
    case "bluesky":
      return business.bluesky_handle;
    case "mastodon":
      return business.mastodon_instance_url;
    case "tumblr":
      return business.tumblr_blog_name;
    case "wechat":
      return business.wechat_official_account_id;
    case "telegram":
      return business.telegram_channel_id;
    case "discord":
      return business.discord_channel_id;
    case "medium":
      return business.medium_publication_id;
    case "vk":
      return business.vk_group_id;
    case "line":
      return business.line_channel_id;
    case "vimeo":
      return business.vimeo_user_id;
    case "flickr":
      return business.flickr_user_id;
    case "foursquare":
      return business.foursquare_venue_id;
    case "bing":
      return business.bing_business_id;
    case "applebusiness":
      return business.applebusiness_location_id;
    case "houzz":
      return business.houzz_business_id;
    case "angi":
      return business.angi_business_id;
    case "thumbtack":
      return business.thumbtack_business_id;
    case "tripadvisor":
      return business.tripadvisor_location_id;
    case "opentable":
      return business.opentable_restaurant_id;
    case "quora":
      return business.quora_space_id;
    case "trustpilot":
      return business.trustpilot_business_unit_id;
    case "yandex":
      return business.yandex_business_id;
    case "weibo":
      return business.weibo_id;
    case "xiaohongshu":
      return business.xiaohongshu_id;
    case "kakaotalk":
      return business.kakaotalk_id;
    case "naver":
      return business.naver_id;
    case "baidu":
      return business.baidu_id;
    case "douyin":
      return business.douyin_id;
    case "kuaishou":
      return business.kuaishou_id;
    case "weverse":
      return business.weverse_id;
    case "signal":
      return business.signal_id;
    case "viber":
      return business.viber_id;
    case "kik":
      return business.kik_id;
    case "skype":
      return business.skype_id;
    case "slack":
      return business.slack_id;
    case "meetup":
      return business.meetup_id;
    case "eventbrite":
      return business.eventbrite_id;
    case "craigslist":
      return business.craigslist_id;
    case "indeed":
      return business.indeed_id;
    case "glassdoor":
      return business.glassdoor_id;
    case "capterra":
      return business.capterra_id;
    case "g2":
      return business.g2_id;
    case "producthunt":
      return business.producthunt_id;
    case "behance":
      return business.behance_id;
    case "dribbble":
      return business.dribbble_id;
    case "deviantart":
      return business.deviantart_id;
    case "fivehundredpx":
      return business.fivehundredpx_id;
    case "unsplash":
      return business.unsplash_id;
    case "soundcloud":
      return business.soundcloud_id;
    case "spotify":
      return business.spotify_id;
    case "applepodcasts":
      return business.applepodcasts_id;
    case "googlepodcasts":
      return business.googlepodcasts_id;
    case "anchor":
      return business.anchor_id;
    case "substack":
      return business.substack_id;
    case "ghost":
      return business.ghost_id;
    case "wordpress":
      return business.wordpress_id;
    case "blogger":
      return business.blogger_id;
    case "weebly":
      return business.weebly_id;
    case "wix":
      return business.wix_id;
    case "squarespace":
      return business.squarespace_id;
    case "etsy":
      return business.etsy_id;
    case "amazon":
      return business.amazon_id;
    case "shopify":
      return business.shopify_id;
    case "walmart":
      return business.walmart_id;
    case "target":
      return business.target_id;
    case "instacart":
      return business.instacart_id;
    case "doordash":
      return business.doordash_id;
    case "ubereats":
      return business.ubereats_id;
    case "grubhub":
      return business.grubhub_id;
    case "postmates":
      return business.postmates_id;
    case "zomato":
      return business.zomato_id;
    case "swiggy":
      return business.swiggy_id;
    case "justeat":
      return business.justeat_id;
    case "deliveroo":
      return business.deliveroo_id;
    case "booking":
      return business.booking_id;
    case "expedia":
      return business.expedia_id;
    case "airbnb":
      return business.airbnb_id;
    case "vrbo":
      return business.vrbo_id;
    case "hotelscom":
      return business.hotelscom_id;
    case "kayak":
      return business.kayak_id;
    case "agoda":
      return business.agoda_id;
    case "trivago":
      return business.trivago_id;
    case "hostelworld":
      return business.hostelworld_id;
    case "couchsurfing":
      return business.couchsurfing_id;
    case "meituan":
      return business.meituan_id;
    case "dianping":
      return business.dianping_id;
    case "gaode":
      return business.gaode_id;
    case "here":
      return business.here_id;
    case "mapquest":
      return business.mapquest_id;
    case "waze":
      return business.waze_id;
    case "alibaba":
      return business.alibaba_id;
    case "tmall":
      return business.tmall_id;
    case "ebay":
      return business.ebay_id;
    case "naverblog":
      return business.naverblog_id;
    default:
      return null;
  }
}

/** The token-bearing column for a platform, used only to populate
 * access_token_ref on platform_connection sync — never used by adapters,
 * which keep reading the real business columns directly. */
function connectionTokenRef(business: Business, platform: Platform): string | null {
  switch (platform) {
    case "gbp":
      return business.gbp_access_token ?? "gbp";
    case "facebook":
      return business.fb_page_access_token;
    case "instagram":
      return business.fb_page_access_token; // IG posting reuses the FB page token
    case "twitter":
      return business.twitter_access_token;
    default:
      return connectionAccountId(business, platform) ? "connected" : null;
  }
}

/** Syncs platform_connection rows (Phase 2.1) from the existing business
 * columns, without touching any adapter's real credential reads. Preserves
 * an existing row's status (e.g. once verified/expired) and only seeds a
 * default status from platformStatus.statusOf() the first time a connection
 * is observed. */
async function syncPlatformConnections(business: Business, platforms: Platform[]): Promise<void> {
  for (const platform of platforms) {
    const accountId = connectionAccountId(business, platform);
    if (!accountId) continue;

    const existing = await getConnection(business.id, platform);
    await upsertConnection({
      businessId: business.id,
      platform,
      accountId,
      accessTokenRef: connectionTokenRef(business, platform),
      status: existing ? undefined : statusOf(platform),
    });
  }
}

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
  await syncPlatformConnections(business, platforms);
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
  await syncPlatformConnections(business, platforms);

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
