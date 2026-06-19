export type Platform = "gbp" | "facebook" | "instagram" | "pinterest" | "twitter" | "linkedin" | "threads" | "yelp" | "nextdoor" | "snapchat" | "tiktok" | "youtube" | "whatsapp" | "reddit" | "bluesky" | "mastodon" | "tumblr" | "wechat" | "telegram" | "discord" | "medium" | "vk" | "line" | "vimeo" | "flickr" | "foursquare" | "bing" | "applebusiness" | "houzz" | "angi" | "thumbtack" | "tripadvisor" | "opentable" | "quora" | "trustpilot" | "yandex";
export type AdPlatform = "meta" | "google";
export type MediaType = "image" | "video";

export interface Business {
  id: string;
  name: string;
  location: string | null;
  location_lat: number | null;
  location_lng: number | null;
  phone: string | null;
  owner_phone: string | null;
  owner_email: string | null;
  gbp_location_id: string | null;
  gbp_access_token: string | null;
  gbp_refresh_token: string | null;
  fb_page_id: string | null;
  fb_page_access_token: string | null;
  ig_business_id: string | null;
  meta_ads_account_id: string | null;
  google_ads_customer_id: string | null;
  google_ads_refresh_token: string | null;
  pinterest_board_id: string | null;
  pinterest_access_token: string | null;
  twitter_access_token: string | null;
  linkedin_organization_id: string | null;
  linkedin_access_token: string | null;
  threads_user_id: string | null;
  threads_access_token: string | null;
  yelp_business_id: string | null;
  yelp_access_token: string | null;
  nextdoor_business_id: string | null;
  nextdoor_access_token: string | null;
  snapchat_profile_id: string | null;
  snapchat_access_token: string | null;
  tiktok_user_id: string | null;
  tiktok_access_token: string | null;
  youtube_channel_id: string | null;
  youtube_refresh_token: string | null;
  whatsapp_phone_number_id: string | null;
  whatsapp_access_token: string | null;
  reddit_subreddit: string | null;
  reddit_access_token: string | null;
  bluesky_handle: string | null;
  bluesky_app_password: string | null;
  mastodon_instance_url: string | null;
  mastodon_access_token: string | null;
  tumblr_blog_name: string | null;
  tumblr_access_token: string | null;
  wechat_official_account_id: string | null;
  wechat_access_token: string | null;
  preferred_language: string | null;
  telegram_channel_id: string | null;
  telegram_access_token: string | null;
  discord_channel_id: string | null;
  discord_access_token: string | null;
  medium_publication_id: string | null;
  medium_access_token: string | null;
  vk_group_id: string | null;
  vk_access_token: string | null;
  line_channel_id: string | null;
  line_access_token: string | null;
  vimeo_user_id: string | null;
  vimeo_access_token: string | null;
  flickr_user_id: string | null;
  flickr_access_token: string | null;
  foursquare_venue_id: string | null;
  foursquare_access_token: string | null;
  bing_business_id: string | null;
  bing_access_token: string | null;
  applebusiness_location_id: string | null;
  applebusiness_access_token: string | null;
  houzz_business_id: string | null;
  houzz_access_token: string | null;
  angi_business_id: string | null;
  angi_access_token: string | null;
  thumbtack_business_id: string | null;
  thumbtack_access_token: string | null;
  tripadvisor_location_id: string | null;
  tripadvisor_access_token: string | null;
  opentable_restaurant_id: string | null;
  opentable_access_token: string | null;
  quora_space_id: string | null;
  quora_access_token: string | null;
  trustpilot_business_unit_id: string | null;
  trustpilot_access_token: string | null;
  yandex_business_id: string | null;
  yandex_access_token: string | null;
}

export type ContentStatus = "queued" | "approved" | "posted" | "rejected" | "edited";
export type ContentSource = "content_engine" | "manual" | "review_triggered";

export interface ContentItem {
  id: string;
  business_id: string;
  source: ContentSource;
  caption: string;
  media_url: string | null;
  media_type: MediaType;
  platforms: Platform[];
  status: ContentStatus;
  review_id: string | null;
  created_at: string;
}

export interface ApprovalRequest {
  id: string;
  content_item_id: string;
  channel: "sms" | "email";
  sent_at: string;
  response: string | null;
  responded_at: string | null;
  timeout_action: "auto_post" | "hold";
}

export interface Post {
  id: string;
  content_item_id: string;
  platform: Platform;
  platform_post_id: string | null;
  posted_at: string | null;
  views: number;
  clicks: number;
  calls: number;
  engagement: number;
  last_polled_at: string | null;
}

export interface BoostTrigger {
  id: string;
  post_id: string;
  threshold_met_at: string;
  owner_response: string | null;
  responded_at: string | null;
  handed_off_to_marketing: boolean;
  ad_platform: AdPlatform | null;
  ad_campaign_id: string | null;
  budget_cents: number | null;
}

export interface Review {
  id: string;
  business_id: string;
  source: string;
  rating: number | null;
  text: string | null;
  customer_name: string | null;
  received_at: string;
  suggested_reply: string | null;
}

export interface GeneratedPost {
  caption: string;
  mediaUrl: string | null;
  mediaType: MediaType;
  altText: string | null;
}

export interface AdCreative {
  copyVariants: string[];
  imagePrompts: string[];
  imageUrls: string[];
}

export interface Competitor {
  id: string;
  business_id: string;
  name: string;
  gbp_place_id: string | null;
  created_at: string;
}

export interface CompetitorSnapshot {
  id: string;
  competitor_id: string;
  rating: number | null;
  review_count: number | null;
  captured_at: string;
}

export interface SeoAuditResult {
  id: string;
  business_id: string;
  score: number;
  issues: string[];
  run_at: string;
}

export interface ListingSyncResult {
  id: string;
  business_id: string;
  platform: string;
  status: "success" | "failed";
  detail: string | null;
  synced_at: string;
}

export interface RankSnapshot {
  id: string;
  business_id: string;
  keyword: string;
  rank: number | null;
  captured_at: string;
}

export interface SentimentTrendPoint {
  id: string;
  business_id: string;
  avg_rating: number;
  review_count: number;
  period_start: string;
  period_end: string;
}

export interface DuplicateListingFlag {
  id: string;
  business_id: string;
  candidate_place_id: string;
  candidate_name: string;
  candidate_address: string | null;
  detected_at: string;
}
