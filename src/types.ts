export type Platform = "gbp" | "facebook" | "instagram" | "pinterest" | "twitter" | "linkedin" | "threads" | "yelp" | "nextdoor" | "snapchat" | "tiktok" | "youtube";
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
}

export interface GeneratedPost {
  caption: string;
  mediaUrl: string | null;
  mediaType: MediaType;
}

export interface AdCreative {
  copyVariants: string[];
  imagePrompts: string[];
  imageUrls: string[];
}
