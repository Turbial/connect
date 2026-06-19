export type Platform = "gbp" | "facebook" | "instagram" | "pinterest" | "twitter" | "linkedin" | "threads" | "yelp" | "nextdoor" | "snapchat" | "tiktok" | "youtube" | "whatsapp" | "reddit" | "bluesky" | "mastodon" | "tumblr" | "wechat" | "telegram" | "discord" | "medium" | "vk" | "line" | "vimeo" | "flickr" | "foursquare" | "bing" | "applebusiness" | "houzz" | "angi" | "thumbtack" | "tripadvisor" | "opentable" | "quora" | "trustpilot" | "yandex" | "weibo" | "xiaohongshu" | "kakaotalk" | "naver" | "baidu" | "douyin" | "kuaishou" | "weverse" | "signal" | "viber" | "kik" | "skype" | "slack" | "meetup" | "eventbrite" | "craigslist" | "indeed" | "glassdoor" | "capterra" | "g2" | "producthunt" | "behance" | "dribbble" | "deviantart" | "fivehundredpx" | "unsplash" | "soundcloud" | "spotify" | "applepodcasts" | "googlepodcasts" | "anchor" | "substack" | "ghost" | "wordpress" | "blogger" | "weebly" | "wix" | "squarespace" | "etsy" | "amazon" | "shopify" | "walmart" | "target" | "instacart" | "doordash" | "ubereats" | "grubhub" | "postmates" | "zomato" | "swiggy" | "justeat" | "deliveroo" | "booking" | "expedia" | "airbnb" | "vrbo" | "hotelscom" | "kayak" | "agoda" | "trivago" | "hostelworld" | "couchsurfing" | "meituan" | "dianping" | "gaode" | "here" | "mapquest" | "waze" | "alibaba" | "tmall" | "ebay" | "naverblog";
export type AdPlatform = "meta" | "google";
export type MediaType = "image" | "video";

/** "video" is the generic default surface for video platforms with no further
 * surface distinction (Phase 7.4) — the rest distinguish a real surface choice. */
export type Surface = "feed" | "story" | "reel" | "short" | "carousel" | "video";

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
  weibo_id: string | null;
  weibo_access_token: string | null;
  xiaohongshu_id: string | null;
  xiaohongshu_access_token: string | null;
  kakaotalk_id: string | null;
  kakaotalk_access_token: string | null;
  naver_id: string | null;
  naver_access_token: string | null;
  baidu_id: string | null;
  baidu_access_token: string | null;
  douyin_id: string | null;
  douyin_access_token: string | null;
  kuaishou_id: string | null;
  kuaishou_access_token: string | null;
  weverse_id: string | null;
  weverse_access_token: string | null;
  signal_id: string | null;
  signal_access_token: string | null;
  viber_id: string | null;
  viber_access_token: string | null;
  kik_id: string | null;
  kik_access_token: string | null;
  skype_id: string | null;
  skype_access_token: string | null;
  slack_id: string | null;
  slack_access_token: string | null;
  meetup_id: string | null;
  meetup_access_token: string | null;
  eventbrite_id: string | null;
  eventbrite_access_token: string | null;
  craigslist_id: string | null;
  craigslist_access_token: string | null;
  indeed_id: string | null;
  indeed_access_token: string | null;
  glassdoor_id: string | null;
  glassdoor_access_token: string | null;
  capterra_id: string | null;
  capterra_access_token: string | null;
  g2_id: string | null;
  g2_access_token: string | null;
  producthunt_id: string | null;
  producthunt_access_token: string | null;
  behance_id: string | null;
  behance_access_token: string | null;
  dribbble_id: string | null;
  dribbble_access_token: string | null;
  deviantart_id: string | null;
  deviantart_access_token: string | null;
  fivehundredpx_id: string | null;
  fivehundredpx_access_token: string | null;
  unsplash_id: string | null;
  unsplash_access_token: string | null;
  soundcloud_id: string | null;
  soundcloud_access_token: string | null;
  spotify_id: string | null;
  spotify_access_token: string | null;
  applepodcasts_id: string | null;
  applepodcasts_access_token: string | null;
  googlepodcasts_id: string | null;
  googlepodcasts_access_token: string | null;
  anchor_id: string | null;
  anchor_access_token: string | null;
  substack_id: string | null;
  substack_access_token: string | null;
  ghost_id: string | null;
  ghost_access_token: string | null;
  wordpress_id: string | null;
  wordpress_access_token: string | null;
  blogger_id: string | null;
  blogger_access_token: string | null;
  weebly_id: string | null;
  weebly_access_token: string | null;
  wix_id: string | null;
  wix_access_token: string | null;
  squarespace_id: string | null;
  squarespace_access_token: string | null;
  etsy_id: string | null;
  etsy_access_token: string | null;
  amazon_id: string | null;
  amazon_access_token: string | null;
  shopify_id: string | null;
  shopify_access_token: string | null;
  walmart_id: string | null;
  walmart_access_token: string | null;
  target_id: string | null;
  target_access_token: string | null;
  instacart_id: string | null;
  instacart_access_token: string | null;
  doordash_id: string | null;
  doordash_access_token: string | null;
  ubereats_id: string | null;
  ubereats_access_token: string | null;
  grubhub_id: string | null;
  grubhub_access_token: string | null;
  postmates_id: string | null;
  postmates_access_token: string | null;
  zomato_id: string | null;
  zomato_access_token: string | null;
  swiggy_id: string | null;
  swiggy_access_token: string | null;
  justeat_id: string | null;
  justeat_access_token: string | null;
  deliveroo_id: string | null;
  deliveroo_access_token: string | null;
  booking_id: string | null;
  booking_access_token: string | null;
  expedia_id: string | null;
  expedia_access_token: string | null;
  airbnb_id: string | null;
  airbnb_access_token: string | null;
  vrbo_id: string | null;
  vrbo_access_token: string | null;
  hotelscom_id: string | null;
  hotelscom_access_token: string | null;
  kayak_id: string | null;
  kayak_access_token: string | null;
  agoda_id: string | null;
  agoda_access_token: string | null;
  trivago_id: string | null;
  trivago_access_token: string | null;
  hostelworld_id: string | null;
  hostelworld_access_token: string | null;
  couchsurfing_id: string | null;
  couchsurfing_access_token: string | null;
  meituan_id: string | null;
  meituan_access_token: string | null;
  dianping_id: string | null;
  dianping_access_token: string | null;
  gaode_id: string | null;
  gaode_access_token: string | null;
  here_id: string | null;
  here_access_token: string | null;
  mapquest_id: string | null;
  mapquest_access_token: string | null;
  waze_id: string | null;
  waze_access_token: string | null;
  alibaba_id: string | null;
  alibaba_access_token: string | null;
  tmall_id: string | null;
  tmall_access_token: string | null;
  ebay_id: string | null;
  ebay_access_token: string | null;
  naverblog_id: string | null;
  naverblog_access_token: string | null;
  boost_views_threshold: number | null;
  boost_engagement_threshold: number | null;
  boost_budget_cents: number | null;
  approval_timeout_hours: number | null;
  posting_cadence: string | null;
  brand_voice_banned_words: string[] | null;
  website_url: string | null;
  organization_id: string | null;
  service_area: string | null;
  owner_mobile: string | null;
  owner_preferred_channel: PreferredChannel | null;
  services_offered: string[] | null;
  brand_tone: string | null;
  brand_voice_banned_claims: string[] | null;
  logo_url: string | null;
  photo_urls: string[] | null;
  target_locations: string[] | null;
  compliance_restrictions: string[] | null;
  vertical: Vertical | null;
  owner_verified_at: string | null;
  owner_verification_code: string | null;
  owner_verification_code_expires_at: string | null;
  package_tier: PackageTier | null;
  /** Phase 8.2 boost policy fields (doc §18) — all null means "behave
   * exactly as today, always ask." Setting auto_boost_threshold_cents lets
   * handleBoostReply/evaluateBoostTriggers launch a boost without an owner
   * approval round-trip, gated by the rest of the fields below. */
  max_weekly_boost_spend_cents: number | null;
  max_daily_boost_spend_cents: number | null;
  max_boost_per_post_cents: number | null;
  auto_boost_threshold_cents: number | null;
  manual_approval_threshold_cents: number | null;
  boost_allowed_platforms: Platform[] | null;
  boost_stop_loss_cents: number | null;
  boost_budget_reset_schedule: "daily" | "weekly" | null;
  /** Phase 8.8: an external CRM/PM endpoint a lead_intent customer message
   * gets POSTed to — Connect routes the signal, it does not store or manage
   * the lead itself. Null (the default) means no forwarding happens. */
  crm_webhook_url: string | null;
}

/** Phase 6.7: the entitlement tier a business/org is on. Starter and
 * local_operator are the two tiers whose features are fully covered by
 * Phase 6 + existing Phases 1-5; the rest are named placeholders whose
 * features ship in Phase 7/8 — see PACKAGE_FEATURES in lib/packages.ts. */
export type PackageTier = "starter_audit" | "local_operator" | "growth_operator" | "vertical_pro" | "agency" | "franchise";

/** Phase 6.2: the channel the owner has said they want to be reached on for
 * approvals/digests — sms is the only one with a working transport today
 * (Phase 7.1 adds whatsapp); email already exists as a delivery option via
 * the weekly digest. */
export type PreferredChannel = "sms" | "email" | "whatsapp";

/** Phase 6.3: a business's named industry vertical, used to pick a score
 * weight table and audit-report copy. Defaults to "general" — no forced
 * re-categorization of existing rows, and "general" keeps today's implicit
 * equal weighting. */
export type Vertical = "home_services" | "restaurant" | "wellness" | "general";

/** Phase 4.1: sits above business — a business with no organization_id
 * behaves exactly as today (an implicit "org of one"). The setting-default
 * columns mirror the Phase 2.4 business-level columns and are resolved as a
 * fallback by src/lib/orgSettings.ts before the hardcoded constants. */
export interface Organization {
  id: string;
  name: string;
  white_label_name: string | null;
  boost_views_threshold: number | null;
  boost_engagement_threshold: number | null;
  boost_budget_cents: number | null;
  approval_timeout_hours: number | null;
  posting_cadence: string | null;
  brand_voice_banned_words: string[] | null;
  content_paused: boolean;
  /** Phase 8.7: per-org sender identity overrides so an agency's clients see
   * the agency's own number/WhatsApp line, not MightyMax's default — null
   * means "use the platform default," same as every other nullable org
   * setting on this table. */
  twilio_from_number: string | null;
  whatsapp_phone_number_id: string | null;
  created_at: string;
}

/** Phase 4.2: one optional step in an org's approval chain (local manager ->
 * regional manager -> brand compliance, etc). Zero rows for an org means no
 * chain configured. */
export interface ApprovalChainStep {
  id: string;
  organization_id: string;
  step_order: number;
  name: string;
  phone: string | null;
  email: string | null;
  created_at: string;
}

/** Phase 4.2: a reusable, pre-approved snippet an org can queue directly
 * (source: "library") without going through owner approval. */
export interface ContentLibraryItem {
  id: string;
  organization_id: string;
  caption: string;
  media_url: string | null;
  media_type: MediaType;
  platforms: Platform[];
  created_at: string;
}

export interface PlatformConnection {
  id: string;
  business_id: string;
  platform: Platform;
  account_id: string | null;
  account_name: string | null;
  access_token_ref: string | null;
  refresh_token_ref: string | null;
  scopes: string | null;
  status: string;
  expires_at: string | null;
  last_verified_at: string | null;
  last_posted_at: string | null;
  last_metrics_sync_at: string | null;
  failure_reason: string | null;
  created_at: string;
  updated_at: string;
}

export type ContentStatus = "queued" | "approved" | "posted" | "rejected" | "edited";
export type ContentSource = "content_engine" | "manual" | "review_triggered" | "library";

export interface ContentItem {
  id: string;
  business_id: string;
  source: ContentSource;
  caption: string;
  caption_variant_b: string | null;
  media_url: string | null;
  media_type: MediaType;
  surface: Surface;
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
  proposed_rewrite: string | null;
  chain_step_index: number | null;
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
  impressions: number;
  shares: number;
  last_polled_at: string | null;
  /** "b" only for a staggered organic split-test post of the same content
   * item's caption_variant_b (Phase 8.1) — "a" for every post otherwise. */
  variant: "a" | "b";
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
  /** Phase 9.3: the negative-review complaint category this review was
   * classified into, or null if it wasn't negative/classifiable. */
  complaint_theme: ComplaintTheme | null;
}

/** Phase 9.3: a fixed, bounded set of negative-review complaint categories —
 * never an open-ended/freeform label, so theme counts stay comparable across
 * reviews. */
export type ComplaintTheme = "slow_response" | "price" | "quality" | "communication" | "scheduling" | "other";

export interface GeneratedPost {
  caption: string;
  captionVariantB: string | null;
  mediaUrl: string | null;
  mediaType: MediaType;
  surface: Surface;
  altText: string | null;
}

export type NextBestFixStatus = "suggested" | "acted_on";

/** Phase 7.7: tracks a single category's next-best-fix recommendation over
 * time (suggested -> acted_on) per business/category pair, so the weekly
 * digest and chat card can acknowledge a fixed issue instead of repeating
 * stale advice. */
export interface NextBestFixTracking {
  id: string;
  business_id: string;
  category: string;
  recommendation: string;
  status: NextBestFixStatus;
  first_suggested_at: string;
  resolved_at: string | null;
}

export type CalendarSlotStatus = "planned" | "generated" | "approved" | "posted" | "skipped";

/** Phase 7.5: a single planned content slot for a business — backend data
 * model only, no UI. The weekly batch job reads/writes against this instead
 * of generating content purely ad hoc per run. */
export interface ContentCalendarSlot {
  id: string;
  business_id: string;
  platform: Platform;
  surface: Surface;
  planned_date: string;
  status: CalendarSlotStatus;
  content_item_id: string | null;
  created_at: string;
}

export interface AdCreative {
  copyVariants: string[];
  imagePrompts: string[];
  imageUrls: string[];
  /** Phase 3.1: UTM-tagged destination link for outcome attribution, null
   * when the business has no website_url configured. */
  destinationUrl: string | null;
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

/** Generic signal row shared by Phase 12's 12 additional lightweight service
 * modules, instead of a dedicated table per module. */
export interface ServiceSignal {
  id: string;
  business_id: string;
  module: string;
  signal: string;
  value: string | null;
  captured_at: string;
}

export interface DistributionFailure {
  id: string;
  business_id: string;
  content_item_id: string;
  platform: Platform;
  error: string;
  occurred_at: string;
}

/** Phase 3.1: generic non-GBP lead/booking/revenue attribution event. The GBP
 * post.calls field already tracks call attribution at the post level — this
 * is additive, for richer attribution (CRM/forms/bookings/revenue) keyed back
 * to the originating content item/post where attributable. */
export interface LeadEvent {
  id: string;
  business_id: string;
  content_item_id: string | null;
  post_id: string | null;
  platform: Platform | null;
  source: "call" | "form" | "crm" | "booking" | "stripe";
  external_ref: string | null;
  amount_cents: number | null;
  occurred_at: string;
}

/** Phase 6.1: how much real data backs a category's score — never let a
 * category look "verified" when its underlying signal is missing or old. */
export type DataConfidence = "verified" | "stale" | "missing";

/** Phase 6.1: a single category's contribution to the overall score, ranked
 * by how far it pulls the score from a neutral midpoint. */
export interface ScoreDriver {
  category: string;
  score: number;
  direction: "positive" | "negative";
}

/** Phase 3.2: a single 0-100 customer-facing visibility score aggregating the
 * 18 audit/service-module signals into one number with a category breakdown
 * and concrete recommended actions for any category below threshold.
 *
 * Phase 6.1 adds explainability fields (previousScore/trend/drivers/
 * nextBestFix/dataConfidence) computed at read time from the same underlying
 * data — none of them are persisted as new columns, so older rows in the
 * `visibility_score` table remain readable. */
export interface VisibilityScore {
  id: string;
  business_id: string;
  score: number;
  categoryBreakdown: Record<string, number>;
  recommendations: string[];
  computed_at: string;
  previousScore: number | null;
  trend: number | null;
  topDrivers: ScoreDriver[];
  nextBestFix: string | null;
  dataConfidence: Record<string, DataConfidence>;
  /** Phase 6.3: the vertical whose weight table produced `score` — "general"
   * for a business with no vertical set, identical to pre-6.3 behavior. */
  vertical: Vertical;
  /** Phase 6.3: vertical-tailored framing sentence for the audit report,
   * null for verticals without tuned copy yet (never a generic claim
   * dressed up as vertical-specific insight). */
  industryInsight: string | null;
}

/** Phase 5.3: business-facing two-way messaging — the business's own
 * customers texting/chatting with the business, distinct from
 * ApprovalRequest (Connect-to-owner). customer_identifier is a phone number,
 * chat session id, or social handle depending on channel; body is null for
 * missed-call-only events. */
/** Phase 8.8: the fixed, bounded set of intents an inbound customer message
 * gets classified into — not open-ended, mirroring Phase 7.3's edit-reply
 * categories. */
export type MessageIntent = "lead_intent" | "question" | "complaint" | "other";

export interface CustomerMessage {
  id: string;
  business_id: string;
  channel: "sms" | "webchat" | "dm_instagram" | "dm_facebook" | "missed_call";
  direction: "inbound" | "outbound";
  customer_identifier: string;
  body: string | null;
  /** Phase 8.8: null for outbound messages and for any inbound message that
   * wasn't classified (no body, or no DEEPSEEK_API_KEY configured). */
  intent: MessageIntent | null;
  created_at: string;
}

/** Phase 8.9 (doc §15): the unified agent action queue — every action the
 * system takes becomes a record, logged as a parallel audit trail this
 * phase (the existing weekly-batch/trigger code paths are not rewritten to
 * depend on this table yet). */
export type AgentActionSource = "weekly_job" | "owner_message" | "customer_message" | "review" | "missed_call" | "performance_trigger";
export type AgentActionStatus = "pending" | "completed" | "failed" | "awaiting_approval";
export type AgentActionRiskLevel = "low" | "medium" | "high";

export interface AgentAction {
  id: string;
  business_id: string;
  source: AgentActionSource;
  intent: string;
  tool: string;
  input: unknown;
  output: unknown | null;
  status: AgentActionStatus;
  risk_level: AgentActionRiskLevel;
  approval_required: boolean;
  owner_response: string | null;
  platform_result: unknown | null;
  error: string | null;
  retry_count: number;
  audit_log: string[];
  created_at: string;
}

/** Phase 7.3: the fixed, bounded set of edit-reply categories tracked as
 * creative memory — not open-ended free-text storage. */
export type BrandMemoryCategory =
  | "rejected_phrase"
  | "preferred_cta"
  | "tone_correction"
  | "image_style_preference"
  | "platform_preference"
  | "forbidden_claim"
  | "service_emphasis"
  | "offer_to_avoid";

export interface BrandMemory {
  id: string;
  business_id: string;
  category: BrandMemoryCategory;
  content: string;
  created_at: string;
}
