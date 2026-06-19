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
