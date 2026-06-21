-- MightyMax Distribution Layer schema
-- Run against the Supabase project used for this service.
-- Sectioned by phase so it's clear what each table/column supports.

-- ── Phase 1: GBP-only posting, approval, reporting ──────────────────────────

create table if not exists business (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location text,
  location_lat double precision,
  location_lng double precision,
  phone text,
  owner_phone text,
  owner_email text,
  gbp_location_id text,
  gbp_access_token text,
  gbp_refresh_token text,
  created_at timestamptz not null default now()
);

create table if not exists content_item (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references business(id) on delete cascade,
  source text not null default 'content_engine', -- content_engine | manual | review_triggered
  caption text not null,
  media_url text,
  media_type text not null default 'image', -- image | video
  platforms text[] not null default array['gbp'],
  status text not null default 'queued', -- queued | approved | posted | rejected | edited
  review_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists approval_request (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid not null references content_item(id) on delete cascade,
  channel text not null, -- sms | email
  sent_at timestamptz not null default now(),
  response text,
  responded_at timestamptz,
  timeout_action text not null default 'hold' -- auto_post | hold
);

create table if not exists post (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid not null references content_item(id) on delete cascade,
  platform text not null default 'gbp', -- gbp | facebook | instagram
  platform_post_id text,
  posted_at timestamptz,
  views integer default 0,
  clicks integer default 0,
  calls integer default 0,
  engagement integer default 0,
  last_polled_at timestamptz
);

create index if not exists idx_content_item_business on content_item(business_id);
create index if not exists idx_content_item_status on content_item(status);
create index if not exists idx_post_content_item on post(content_item_id);
create index if not exists idx_approval_request_content_item on approval_request(content_item_id);

-- ── Phase 2: Facebook + Instagram connections ───────────────────────────────

alter table business add column if not exists fb_page_id text;
alter table business add column if not exists fb_page_access_token text;
alter table business add column if not exists ig_business_id text;

-- ── Phase 3: organic → paid boost trigger, ad accounts ──────────────────────

alter table business add column if not exists meta_ads_account_id text;
alter table business add column if not exists google_ads_customer_id text;
alter table business add column if not exists google_ads_refresh_token text;

create table if not exists boost_trigger (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references post(id) on delete cascade,
  threshold_met_at timestamptz not null default now(),
  owner_response text, -- yes | no | (timeout)
  responded_at timestamptz,
  handed_off_to_marketing boolean not null default false,
  ad_platform text, -- meta | google
  ad_campaign_id text,
  budget_cents integer,
  created_at timestamptz not null default now()
);

create index if not exists idx_boost_trigger_post on boost_trigger(post_id);

-- ── Phase 4: Reach review → content feedback loop ───────────────────────────

create table if not exists review (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references business(id) on delete cascade,
  source text not null default 'reach',
  rating integer,
  text text,
  customer_name text,
  received_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'content_item_review_fk'
  ) then
    alter table content_item add constraint content_item_review_fk
      foreign key (review_id) references review(id) on delete set null;
  end if;
end $$;

create index if not exists idx_review_business on review(business_id);

-- ── Phase 5: Pinterest, X, LinkedIn connections ─────────────────────────────
-- TikTok and YouTube are intentionally excluded: both require video assets,
-- and the Content Engine currently only generates static images.

alter table business add column if not exists pinterest_board_id text;
alter table business add column if not exists pinterest_access_token text;
alter table business add column if not exists twitter_access_token text;
alter table business add column if not exists linkedin_organization_id text;
alter table business add column if not exists linkedin_access_token text;

-- ── Phase 6: Threads, Yelp, Nextdoor, Snapchat connections ──────────────────
-- Doubles organic platform coverage to 10. Still no video platforms (TikTok,
-- YouTube) for the same reason as Phase 5: the Content Engine only generates
-- static images today.

alter table business add column if not exists threads_user_id text;
alter table business add column if not exists threads_access_token text;
alter table business add column if not exists yelp_business_id text;
alter table business add column if not exists yelp_access_token text;
alter table business add column if not exists nextdoor_business_id text;
alter table business add column if not exists nextdoor_access_token text;
alter table business add column if not exists snapchat_profile_id text;
alter table business add column if not exists snapchat_access_token text;

-- ── Phase 7: TikTok + YouTube (video) connections ───────────────────────────
-- Adds the two video-first platforms, now that the Content Engine can
-- generate short video clips via fal.ai in addition to static images.

alter table content_item add column if not exists media_type text not null default 'image';
alter table business add column if not exists tiktok_user_id text;
alter table business add column if not exists tiktok_access_token text;
alter table business add column if not exists youtube_channel_id text;
alter table business add column if not exists youtube_refresh_token text;

-- ── Phase 8: WhatsApp, Reddit, Bluesky, Mastodon, Tumblr, WeChat ────────────
-- Triples organic platform coverage from the Phase 6 baseline, bringing
-- total organic platform coverage to 18.

alter table business add column if not exists whatsapp_phone_number_id text;
alter table business add column if not exists whatsapp_access_token text;
alter table business add column if not exists reddit_subreddit text;
alter table business add column if not exists reddit_access_token text;
alter table business add column if not exists bluesky_handle text;
alter table business add column if not exists bluesky_app_password text;
alter table business add column if not exists mastodon_instance_url text;
alter table business add column if not exists mastodon_access_token text;
alter table business add column if not exists tumblr_blog_name text;
alter table business add column if not exists tumblr_access_token text;
alter table business add column if not exists wechat_official_account_id text;
alter table business add column if not exists wechat_access_token text;

-- ── Phase 9: AI feature expansion (hashtag/SEO, translation, sentiment tone) ─
-- Triples the Content Engine's AI capabilities beyond plain copy+image+video
-- generation: SEO-optimized hashtag generation, multi-language translation,
-- and sentiment-aware tone adjustment for review-triggered content.

alter table business add column if not exists preferred_language text;

-- ── Phase 10: service module expansion (SEO audit, competitor monitoring, ──
-- ── listings/NAP sync) ───────────────────────────────────────────────────
-- Triples the product's service offering beyond posting/AI: a local SEO/
-- citation completeness audit, competitor rating/review tracking, and NAP
-- (Name/Address/Phone) sync back out to connected platforms.

create table if not exists seo_audit (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references business(id) on delete cascade,
  score integer not null,
  issues text[] not null default array[]::text[],
  run_at timestamptz not null default now()
);

create table if not exists competitor (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references business(id) on delete cascade,
  name text not null,
  gbp_place_id text,
  created_at timestamptz not null default now()
);

create table if not exists competitor_snapshot (
  id uuid primary key default gen_random_uuid(),
  competitor_id uuid not null references competitor(id) on delete cascade,
  rating numeric,
  review_count integer,
  captured_at timestamptz not null default now()
);

create table if not exists listing_sync (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references business(id) on delete cascade,
  platform text not null,
  status text not null, -- success | failed
  detail text,
  synced_at timestamptz not null default now()
);

create index if not exists idx_seo_audit_business on seo_audit(business_id);
create index if not exists idx_competitor_business on competitor(business_id);
create index if not exists idx_competitor_snapshot_competitor on competitor_snapshot(competitor_id);
create index if not exists idx_listing_sync_business on listing_sync(business_id);

-- ── Phase 11: double platforms, AI capabilities, and service modules ───────
-- Doubles organic platform coverage (18 → 36), Content Engine AI capabilities
-- (3 → 6: hashtags/translation/sentiment-tone → + alt-text/trending-idea/
-- review-reply-draft), and service modules (3 → 6: seo-audit/competitor-
-- monitor/listings → + rank-tracker/sentiment-tracker/duplicate-listing-check).

alter table business add column if not exists telegram_channel_id text;
alter table business add column if not exists telegram_access_token text;
alter table business add column if not exists discord_channel_id text;
alter table business add column if not exists discord_access_token text;
alter table business add column if not exists medium_publication_id text;
alter table business add column if not exists medium_access_token text;
alter table business add column if not exists vk_group_id text;
alter table business add column if not exists vk_access_token text;
alter table business add column if not exists line_channel_id text;
alter table business add column if not exists line_access_token text;
alter table business add column if not exists vimeo_user_id text;
alter table business add column if not exists vimeo_access_token text;
alter table business add column if not exists flickr_user_id text;
alter table business add column if not exists flickr_access_token text;
alter table business add column if not exists foursquare_venue_id text;
alter table business add column if not exists foursquare_access_token text;
alter table business add column if not exists bing_business_id text;
alter table business add column if not exists bing_access_token text;
alter table business add column if not exists applebusiness_location_id text;
alter table business add column if not exists applebusiness_access_token text;
alter table business add column if not exists houzz_business_id text;
alter table business add column if not exists houzz_access_token text;
alter table business add column if not exists angi_business_id text;
alter table business add column if not exists angi_access_token text;
alter table business add column if not exists thumbtack_business_id text;
alter table business add column if not exists thumbtack_access_token text;
alter table business add column if not exists tripadvisor_location_id text;
alter table business add column if not exists tripadvisor_access_token text;
alter table business add column if not exists opentable_restaurant_id text;
alter table business add column if not exists opentable_access_token text;
alter table business add column if not exists quora_space_id text;
alter table business add column if not exists quora_access_token text;
alter table business add column if not exists trustpilot_business_unit_id text;
alter table business add column if not exists trustpilot_access_token text;
alter table business add column if not exists yandex_business_id text;
alter table business add column if not exists yandex_access_token text;

alter table content_item add column if not exists alt_text text;
alter table review add column if not exists suggested_reply text;

create table if not exists rank_snapshot (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references business(id) on delete cascade,
  keyword text not null,
  rank integer,
  captured_at timestamptz not null default now()
);

create table if not exists sentiment_trend (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references business(id) on delete cascade,
  avg_rating numeric not null,
  review_count integer not null,
  period_start timestamptz not null,
  period_end timestamptz not null
);

create table if not exists duplicate_listing_flag (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references business(id) on delete cascade,
  candidate_place_id text not null,
  candidate_name text not null,
  candidate_address text,
  detected_at timestamptz not null default now()
);

create index if not exists idx_rank_snapshot_business on rank_snapshot(business_id);
create index if not exists idx_sentiment_trend_business on sentiment_trend(business_id);
create index if not exists idx_duplicate_listing_flag_business on duplicate_listing_flag(business_id);

-- ── Phase 12: triple platforms again, double AI/service depth ──────────────
-- Triples organic platform coverage (36 → 108), AI capabilities (6 → 18),
-- and service modules (6 → 18), then doubles per-item richness across the
-- board: a second caption variant per content item, impressions/shares
-- added to post metrics, and a generic service_signal table backing the
-- 12 new lightweight service modules instead of one table each.

alter table business add column if not exists weibo_id text;
alter table business add column if not exists weibo_access_token text;
alter table business add column if not exists xiaohongshu_id text;
alter table business add column if not exists xiaohongshu_access_token text;
alter table business add column if not exists kakaotalk_id text;
alter table business add column if not exists kakaotalk_access_token text;
alter table business add column if not exists naver_id text;
alter table business add column if not exists naver_access_token text;
alter table business add column if not exists baidu_id text;
alter table business add column if not exists baidu_access_token text;
alter table business add column if not exists douyin_id text;
alter table business add column if not exists douyin_access_token text;
alter table business add column if not exists kuaishou_id text;
alter table business add column if not exists kuaishou_access_token text;
alter table business add column if not exists weverse_id text;
alter table business add column if not exists weverse_access_token text;
alter table business add column if not exists signal_id text;
alter table business add column if not exists signal_access_token text;
alter table business add column if not exists viber_id text;
alter table business add column if not exists viber_access_token text;
alter table business add column if not exists kik_id text;
alter table business add column if not exists kik_access_token text;
alter table business add column if not exists skype_id text;
alter table business add column if not exists skype_access_token text;
alter table business add column if not exists slack_id text;
alter table business add column if not exists slack_access_token text;
alter table business add column if not exists meetup_id text;
alter table business add column if not exists meetup_access_token text;
alter table business add column if not exists eventbrite_id text;
alter table business add column if not exists eventbrite_access_token text;
alter table business add column if not exists craigslist_id text;
alter table business add column if not exists craigslist_access_token text;
alter table business add column if not exists indeed_id text;
alter table business add column if not exists indeed_access_token text;
alter table business add column if not exists glassdoor_id text;
alter table business add column if not exists glassdoor_access_token text;
alter table business add column if not exists capterra_id text;
alter table business add column if not exists capterra_access_token text;
alter table business add column if not exists g2_id text;
alter table business add column if not exists g2_access_token text;
alter table business add column if not exists producthunt_id text;
alter table business add column if not exists producthunt_access_token text;
alter table business add column if not exists behance_id text;
alter table business add column if not exists behance_access_token text;
alter table business add column if not exists dribbble_id text;
alter table business add column if not exists dribbble_access_token text;
alter table business add column if not exists deviantart_id text;
alter table business add column if not exists deviantart_access_token text;
alter table business add column if not exists fivehundredpx_id text;
alter table business add column if not exists fivehundredpx_access_token text;
alter table business add column if not exists unsplash_id text;
alter table business add column if not exists unsplash_access_token text;
alter table business add column if not exists soundcloud_id text;
alter table business add column if not exists soundcloud_access_token text;
alter table business add column if not exists spotify_id text;
alter table business add column if not exists spotify_access_token text;
alter table business add column if not exists applepodcasts_id text;
alter table business add column if not exists applepodcasts_access_token text;
alter table business add column if not exists googlepodcasts_id text;
alter table business add column if not exists googlepodcasts_access_token text;
alter table business add column if not exists anchor_id text;
alter table business add column if not exists anchor_access_token text;
alter table business add column if not exists substack_id text;
alter table business add column if not exists substack_access_token text;
alter table business add column if not exists ghost_id text;
alter table business add column if not exists ghost_access_token text;
alter table business add column if not exists wordpress_id text;
alter table business add column if not exists wordpress_access_token text;
alter table business add column if not exists blogger_id text;
alter table business add column if not exists blogger_access_token text;
alter table business add column if not exists weebly_id text;
alter table business add column if not exists weebly_access_token text;
alter table business add column if not exists wix_id text;
alter table business add column if not exists wix_access_token text;
alter table business add column if not exists squarespace_id text;
alter table business add column if not exists squarespace_access_token text;
alter table business add column if not exists etsy_id text;
alter table business add column if not exists etsy_access_token text;
alter table business add column if not exists amazon_id text;
alter table business add column if not exists amazon_access_token text;
alter table business add column if not exists shopify_id text;
alter table business add column if not exists shopify_access_token text;
alter table business add column if not exists walmart_id text;
alter table business add column if not exists walmart_access_token text;
alter table business add column if not exists target_id text;
alter table business add column if not exists target_access_token text;
alter table business add column if not exists instacart_id text;
alter table business add column if not exists instacart_access_token text;
alter table business add column if not exists doordash_id text;
alter table business add column if not exists doordash_access_token text;
alter table business add column if not exists ubereats_id text;
alter table business add column if not exists ubereats_access_token text;
alter table business add column if not exists grubhub_id text;
alter table business add column if not exists grubhub_access_token text;
alter table business add column if not exists postmates_id text;
alter table business add column if not exists postmates_access_token text;
alter table business add column if not exists zomato_id text;
alter table business add column if not exists zomato_access_token text;
alter table business add column if not exists swiggy_id text;
alter table business add column if not exists swiggy_access_token text;
alter table business add column if not exists justeat_id text;
alter table business add column if not exists justeat_access_token text;
alter table business add column if not exists deliveroo_id text;
alter table business add column if not exists deliveroo_access_token text;
alter table business add column if not exists booking_id text;
alter table business add column if not exists booking_access_token text;
alter table business add column if not exists expedia_id text;
alter table business add column if not exists expedia_access_token text;
alter table business add column if not exists airbnb_id text;
alter table business add column if not exists airbnb_access_token text;
alter table business add column if not exists vrbo_id text;
alter table business add column if not exists vrbo_access_token text;
alter table business add column if not exists hotelscom_id text;
alter table business add column if not exists hotelscom_access_token text;
alter table business add column if not exists kayak_id text;
alter table business add column if not exists kayak_access_token text;
alter table business add column if not exists agoda_id text;
alter table business add column if not exists agoda_access_token text;
alter table business add column if not exists trivago_id text;
alter table business add column if not exists trivago_access_token text;
alter table business add column if not exists hostelworld_id text;
alter table business add column if not exists hostelworld_access_token text;
alter table business add column if not exists couchsurfing_id text;
alter table business add column if not exists couchsurfing_access_token text;
alter table business add column if not exists meituan_id text;
alter table business add column if not exists meituan_access_token text;
alter table business add column if not exists dianping_id text;
alter table business add column if not exists dianping_access_token text;
alter table business add column if not exists gaode_id text;
alter table business add column if not exists gaode_access_token text;
alter table business add column if not exists here_id text;
alter table business add column if not exists here_access_token text;
alter table business add column if not exists mapquest_id text;
alter table business add column if not exists mapquest_access_token text;
alter table business add column if not exists waze_id text;
alter table business add column if not exists waze_access_token text;
alter table business add column if not exists alibaba_id text;
alter table business add column if not exists alibaba_access_token text;
alter table business add column if not exists tmall_id text;
alter table business add column if not exists tmall_access_token text;
alter table business add column if not exists ebay_id text;
alter table business add column if not exists ebay_access_token text;
alter table business add column if not exists naverblog_id text;
alter table business add column if not exists naverblog_access_token text;
-- Phase 15: 10 more marketplace/resale platforms added as generic stub
-- adapters (see src/distribution/genericAdapter.ts) alongside Phase 12's.
alter table business add column if not exists shopee_id text;
alter table business add column if not exists shopee_access_token text;
alter table business add column if not exists lazada_id text;
alter table business add column if not exists lazada_access_token text;
alter table business add column if not exists mercadolibre_id text;
alter table business add column if not exists mercadolibre_access_token text;
alter table business add column if not exists rakuten_id text;
alter table business add column if not exists rakuten_access_token text;
alter table business add column if not exists aliexpress_id text;
alter table business add column if not exists aliexpress_access_token text;
alter table business add column if not exists wish_id text;
alter table business add column if not exists wish_access_token text;
alter table business add column if not exists depop_id text;
alter table business add column if not exists depop_access_token text;
alter table business add column if not exists poshmark_id text;
alter table business add column if not exists poshmark_access_token text;
alter table business add column if not exists vinted_id text;
alter table business add column if not exists vinted_access_token text;
alter table business add column if not exists snapdeal_id text;
alter table business add column if not exists snapdeal_access_token text;
alter table content_item add column if not exists caption_variant_b text;
alter table post add column if not exists impressions integer not null default 0;
alter table post add column if not exists shares integer not null default 0;

create table if not exists service_signal (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references business(id) on delete cascade,
  module text not null,
  signal text not null,
  value text,
  captured_at timestamptz not null default now()
);

create index if not exists idx_service_signal_business on service_signal(business_id);
create index if not exists idx_service_signal_module on service_signal(module);

-- ── Development Program Phase 1.3/1.4: reliability primitives ──────────────
-- Idempotency: prevent duplicate live posts to the same platform for the
-- same content item if a dispatch is retried after a partial failure.
-- Superseded by a (content_item_id, platform, variant) index in Phase 8.1.
create unique index if not exists idx_post_unique_item_platform on post(content_item_id, platform);

-- Structured, queryable failure logging for distribution dispatch, instead
-- of errors only being thrown/swallowed.
create table if not exists distribution_failure (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references business(id) on delete cascade,
  content_item_id uuid not null references content_item(id) on delete cascade,
  platform text not null,
  error text not null,
  occurred_at timestamptz not null default now()
);

create index if not exists idx_distribution_failure_business on distribution_failure(business_id);

-- ── Development Program Phase 2: Front Door & Verified Core ────────────────

-- 2.1: normalized platform connections, additive alongside the existing
-- business.<platform>_id/<platform>_access_token columns. connectedPlatforms()
-- syncs rows here so this becomes the single source of truth for connection
-- status going forward, without requiring a rewrite of every adapter.
create table if not exists platform_connection (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references business(id) on delete cascade,
  platform text not null,
  account_id text,
  account_name text,
  access_token_ref text,
  refresh_token_ref text,
  scopes text,
  status text not null default 'sandbox',
  expires_at timestamptz,
  last_verified_at timestamptz,
  last_posted_at timestamptz,
  last_metrics_sync_at timestamptz,
  failure_reason text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index if not exists idx_platform_connection_business_platform on platform_connection(business_id, platform);
create index if not exists idx_platform_connection_business on platform_connection(business_id);

-- 2.4: per-business adaptability settings that actually drive behavior
-- (trigger thresholds, boost budget, approval timeout, brand-voice basics).
alter table business add column if not exists boost_views_threshold integer;
alter table business add column if not exists boost_engagement_threshold integer;
alter table business add column if not exists boost_budget_cents integer;
alter table business add column if not exists approval_timeout_hours integer;
alter table business add column if not exists posting_cadence text not null default 'weekly';
alter table business add column if not exists brand_voice_banned_words text[] not null default array[]::text[];

-- ── Development Program Phase 3: ROI & Agent Operations ────────────────────

-- 3.1: canonical business website link, UTM-tagged via src/lib/utm.ts wherever
-- a destination URL is embedded in generated content (currently ad creative;
-- see src/ads/creative.ts). Nullable since not every business has a site yet.
alter table business add column if not exists website_url text;

-- 3.1: generic lead/booking/revenue attribution event, additive alongside the
-- existing post.calls GBP-level call attribution. This is the ingestion point
-- a future CRM/Stripe webhook handler would call via src/lib/leadEvents.ts —
-- no such webhook exists yet, so source/external_ref stay generic rather than
-- modeling a specific provider's payload shape.
create table if not exists lead_event (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references business(id) on delete cascade,
  content_item_id uuid references content_item(id) on delete set null,
  post_id uuid references post(id) on delete set null,
  platform text,
  source text not null, -- call | form | crm | booking | stripe
  external_ref text,
  amount_cents integer,
  occurred_at timestamptz not null default now()
);

create index if not exists idx_lead_event_business on lead_event(business_id);
create index if not exists idx_lead_event_content_item on lead_event(content_item_id);
create index if not exists idx_lead_event_post on lead_event(post_id);

-- 3.2: Local Visibility Score v1 — persisted aggregate of the 18 audit/
-- service-module signals into one 0-100 score, with a category breakdown and
-- concrete recommended actions, computed by src/visibility-score/index.ts.
create table if not exists visibility_score (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references business(id) on delete cascade,
  score integer not null,
  category_breakdown jsonb not null default '{}'::jsonb,
  recommendations jsonb not null default '[]'::jsonb,
  computed_at timestamptz not null default now()
);

create index if not exists idx_visibility_score_business on visibility_score(business_id);

-- 3.3: EDIT auto-rewrite — the agent-drafted rewrite proposed to the owner,
-- pending their second YES/NO. Stored on approval_request (the row already
-- tracking the EDIT reply) rather than content_item, since the rewrite isn't
-- live until the owner approves it — content_item.caption is only overwritten
-- on that second YES (see src/approval/index.ts draftEditRewrite/applyEditRewrite).
alter table approval_request add column if not exists proposed_rewrite text;

-- ── Development Program Phase 4: Adaptability at Scale ──────────────────────

-- 4.1: organization sits above business (a business with no organization_id
-- behaves exactly as today — an implicit "org of one", not a row that needs
-- backfilling). white_label_name, when set, replaces "MightyMax" in owner-
-- facing message copy (see src/lib/orgSettings.ts orgDisplayName()). The
-- setting-default columns mirror Phase 2.4's business-level columns exactly,
-- providing an org-level fallback resolved by src/lib/orgSettings.ts before
-- the hardcoded constants.
create table if not exists organization (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  white_label_name text,
  boost_views_threshold integer,
  boost_engagement_threshold integer,
  boost_budget_cents integer,
  approval_timeout_hours integer,
  posting_cadence text,
  brand_voice_banned_words text[],
  content_paused boolean not null default false,
  created_at timestamptz not null default now()
);

alter table business add column if not exists organization_id uuid references organization(id) on delete set null;
create index if not exists idx_business_organization on business(organization_id);

-- 4.2: optional hierarchical approval chain. Zero rows for an organization
-- means no chain — requestApproval/handleSmsReply fall back to the existing
-- single-owner SMS YES/NO flow unchanged.
create table if not exists approval_chain_step (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organization(id) on delete cascade,
  step_order integer not null,
  name text not null,
  phone text,
  email text,
  created_at timestamptz not null default now()
);

create index if not exists idx_approval_chain_step_organization on approval_chain_step(organization_id, step_order);

-- Tracks which chain step a request is currently awaiting a YES from. Null
-- for non-chain requests (today's behavior, unaffected).
alter table approval_request add column if not exists chain_step_index integer;

-- 4.2: pre-approved content library — items here skip requestApproval
-- entirely (source = 'library') since they're pre-approved by definition.
create table if not exists content_library_item (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organization(id) on delete cascade,
  caption text not null,
  media_url text,
  media_type text not null default 'image',
  platforms text[] not null default array[]::text[],
  created_at timestamptz not null default now()
);

create index if not exists idx_content_library_item_organization on content_library_item(organization_id);

-- ── Development Program Phase 5: Durable Moats (5.1, 5.3) ──────────────────

-- 5.1 (partner access risk register) is intentionally not a table — it's a
-- maintainable in-code structure (src/lib/partnerAccessRisk.ts), not data
-- needing persistence/history, per the development program's own framing.

-- 5.3: business-facing two-way messaging (the business's own customers
-- texting/chatting with the business) — distinct from approval_request,
-- which is Connect-to-owner, not customer-to-business. body is null for
-- missed-call-only events (src/lib/missedCallTextback.ts).
create table if not exists customer_message (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references business(id) on delete cascade,
  channel text not null, -- sms | webchat | dm_instagram | dm_facebook | missed_call
  direction text not null, -- inbound | outbound
  customer_identifier text not null,
  body text,
  created_at timestamptz not null default now()
);

-- 8.8: bounded intent classification for inbound customer messages
-- (lead_intent | question | complaint | other) — null for outbound messages
-- and anything that couldn't be classified.
alter table customer_message add column if not exists intent text;

create index if not exists idx_customer_message_business on customer_message(business_id, created_at);
create index if not exists idx_customer_message_identifier on customer_message(business_id, customer_identifier);

-- ── Development Program Phase 6 ─────────────────────────────────────────────

-- 6.7: package/entitlement tier. Null defaults to the most restrictive tier
-- (starter_audit) in src/lib/packages.ts — never silently full access.
alter table business add column if not exists package_tier text;

-- ── Development Program Phase 7 ─────────────────────────────────────────────

-- 7.3: classified owner edit feedback, persisted per business as durable
-- creative memory that biases future content generation (src/content-engine/
-- generate.ts) rather than just resolving the single rewrite that triggered it.
create table if not exists brand_memory (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references business(id) on delete cascade,
  category text not null,
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_brand_memory_business on brand_memory(business_id);

-- 7.4: surface dimension alongside media_type (feed | story | reel | short |
-- carousel), only meaningfully distinct on a few platforms — see
-- src/content-engine/generate.ts's surfaceFor().
alter table content_item add column if not exists surface text not null default 'feed';

-- 7.5: content calendar backend — what's planned for a business this week,
-- independent of when it's actually generated/posted. The weekly batch job
-- reads/writes against this instead of generating content purely ad hoc.
create table if not exists content_calendar (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references business(id) on delete cascade,
  platform text not null,
  surface text not null default 'feed',
  planned_date date not null,
  status text not null default 'planned', -- planned | generated | approved | posted | skipped
  content_item_id uuid references content_item(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_content_calendar_business on content_calendar(business_id, planned_date);

-- 7.7: tracks each category's next-best-fix recommendation over time
-- (suggested -> acted_on), so the weekly digest/chat card can acknowledge a
-- resolved issue instead of repeating stale advice. One open row per
-- business/category at a time.
create table if not exists next_best_fix (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references business(id) on delete cascade,
  category text not null,
  recommendation text not null,
  status text not null default 'suggested', -- suggested | acted_on
  first_suggested_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (business_id, category)
);

create index if not exists idx_next_best_fix_business on next_best_fix(business_id);

-- ── Development Program Phase 8 ─────────────────────────────────────────────
-- 8.1: a content item's caption_variant_b can now be posted as its own,
-- separately trackable post (staggered after the "a" variant, when organic
-- split-testing is feasible) so its engagement can be measured rather than
-- only ever existing as approval-flow reference text.
alter table post add column if not exists variant text not null default 'a'; -- a | b

drop index if exists idx_post_unique_item_platform;
create unique index if not exists idx_post_unique_item_platform_variant on post(content_item_id, platform, variant);

-- 8.2: per-business boost policy (doc §18) — every field defaults to null,
-- meaning "behave exactly as today, always ask the owner."
alter table business add column if not exists max_weekly_boost_spend_cents integer;
alter table business add column if not exists max_daily_boost_spend_cents integer;
alter table business add column if not exists max_boost_per_post_cents integer;
alter table business add column if not exists auto_boost_threshold_cents integer;
alter table business add column if not exists manual_approval_threshold_cents integer;
alter table business add column if not exists boost_allowed_platforms text[];
alter table business add column if not exists boost_stop_loss_cents integer;
alter table business add column if not exists boost_budget_reset_schedule text; -- daily | weekly

-- 8.7: per-org sender-identity overrides for SMS/WhatsApp so an agency's
-- clients see the agency's own number/WhatsApp line end-to-end, not just in
-- the email subject line. Null means "use the platform default."
alter table organization add column if not exists twilio_from_number text;
alter table organization add column if not exists whatsapp_phone_number_id text;

-- 8.8: optional external CRM/PM webhook a lead_intent customer message is
-- POSTed to — Connect routes the signal, it does not store/manage the lead.
alter table business add column if not exists crm_webhook_url text;

-- 8.9 (doc §15): unified agent action queue — a parallel audit trail of
-- every action the system takes this phase, not yet load-bearing for any
-- existing code path (the weekly cron loop is not rewritten to depend on
-- this table).
create table if not exists agent_action (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references business(id) on delete cascade,
  source text not null, -- weekly_job | owner_message | customer_message | review | missed_call | performance_trigger
  intent text not null,
  tool text not null,
  input jsonb not null,
  output jsonb,
  status text not null, -- pending | completed | failed | awaiting_approval
  risk_level text not null, -- low | medium | high
  approval_required boolean not null default false,
  owner_response text,
  platform_result jsonb,
  error text,
  retry_count integer not null default 0,
  audit_log jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_agent_action_business on agent_action(business_id, created_at);

-- ── Phase 9.3: repeated negative-review complaint theme detection ───────────
alter table review add column if not exists complaint_theme text;

-- ── Phase 14.3: post engagement-score history, for trend/velocity detection
-- (collectPerformance appends one row per poll instead of overwriting in
-- place, same snapshot-table pattern as rank_snapshot/sentiment_trend) ──────
create table if not exists post_metric_snapshot (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references post(id) on delete cascade,
  score numeric not null,
  captured_at timestamptz not null default now()
);

create index if not exists idx_post_metric_snapshot_post on post_metric_snapshot(post_id, captured_at);

-- ── Phase 15 security hardening: caps brute-force attempts against a sent
-- owner verification code (confirmOwnerVerification refuses once this hits
-- MAX_VERIFICATION_ATTEMPTS), reset to 0 whenever a fresh code is sent ──────
alter table business add column if not exists owner_verification_attempts integer not null default 0;

-- ── Platform hardening: WhatsApp Cloud API requires a `to` recipient on every
-- send and has no broadcast/follower concept — this is the single recipient
-- an operator configures until a real customer opt-in list exists ─────────
alter table business add column if not exists whatsapp_broadcast_recipient text;

-- ── Phase 16: per-customer accounts/sessions, replacing the single shared
-- CONNECT_AGENT_API_KEY as the only way to authenticate to the agent API.
-- account_business is a join table since one account may eventually manage
-- more than one business (e.g. an agency staffer); a session row is looked
-- up by its random `token` on every request and expires independently of
-- the account itself ─────────────────────────────────────────────────────
create table if not exists account (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists account_business (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references account(id) on delete cascade,
  business_id uuid not null references business(id) on delete cascade,
  role text not null default 'owner', -- owner | staff
  created_at timestamptz not null default now(),
  unique (account_id, business_id)
);

create index if not exists idx_account_business_account on account_business(account_id);
create index if not exists idx_account_business_business on account_business(business_id);

create table if not exists session (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references account(id) on delete cascade,
  token text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_session_token on session(token);

-- ── Phase 16: white-label report branding — backs the previously-unused
-- white_label_reports PackageFeature (src/lib/packages.ts). Lives on
-- organization, not business, since branding is set agency/franchise-wide,
-- matching white_label_name's existing scope ─────────────────────────────
alter table organization add column if not exists report_logo_url text;
alter table organization add column if not exists report_primary_color text;
