-- MightyMax Distribution Layer — Phase 1 schema (GBP-only)
-- Run against the Supabase project used for this service.

create table if not exists business (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location text,
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
  source text not null default 'content_engine', -- content_engine | manual
  caption text not null,
  media_url text,
  platforms text[] not null default array['gbp'],
  status text not null default 'queued', -- queued | approved | posted | rejected | edited
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
  platform text not null default 'gbp',
  platform_post_id text,
  posted_at timestamptz,
  views integer default 0,
  clicks integer default 0,
  calls integer default 0,
  last_polled_at timestamptz
);

create index if not exists idx_content_item_business on content_item(business_id);
create index if not exists idx_content_item_status on content_item(status);
create index if not exists idx_post_content_item on post(content_item_id);
create index if not exists idx_approval_request_content_item on approval_request(content_item_id);
