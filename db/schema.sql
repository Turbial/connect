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
