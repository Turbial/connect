# MightyMax Connect — Functionality Reference for UI Design

This document describes what the system actually does today, grounded in the
real backend (`src/tools/registry.ts`, `src/distribution/*`, `src/index.ts`),
not aspirational features. Use it as the source of truth for designing pages
and flows — every capability listed has a working tool/endpoint behind it.

## 1. Core concept

One **business** = one tenant. An agency/operator manages businesses through
a single shared API key (no per-customer login yet — see §7 Known Gaps).
Each business connects platforms, gets weekly AI-drafted content, approves it
by SMS/email, and the system posts it automatically, tracks what happened,
and rolls performance into a single Visibility Score.

The weekly loop, end to end:
```
queue_content → owner approval (SMS/email) → automatic posting to each
connected platform → insight/result polling → score recompute → repeat
```
Nothing posts without an approval **unless** an approval times out, in which
case `timeout_action` (`auto_post` or `hold`) decides what happens.

## 2. Entities a UI needs to model

| Entity | Key fields | Notes |
|---|---|---|
| **Business** | name, location, phone, owner_phone/email, posting_cadence | Plus one credential pair per platform (see §4) |
| **ContentItem** | caption, caption_variant_b, media_url/type, platforms[], status | status: queued → approved/edited → posted |
| **ApprovalRequest** | channel (sms/email), response, timeout_action | One per content item sent to the owner |
| **Post** | platform, platform_post_id, posted_at, views/clicks/calls/engagement/impressions/shares, variant (a/b) | The real outcome of a dispatch |
| **DistributionFailure** | platform, error, occurred_at | The real failure if a dispatch didn't succeed |
| **PlatformConnection** | platform, status (verified/sandbox/partner_gated/stub/expired/...), account_id | Drives the Connections card |
| **BoostTrigger** | post_id, threshold_met_at, owner_response, ad_platform | Organic→paid escalation |
| **LeadEvent** | source (call/form/crm/booking/stripe), platform, amount_cents | Revenue/lead attribution |
| **Competitor** + snapshot | name, gbp_place_id, rating, review_count | Tracked over time |
| **VisibilityScore** | score 0-100, category breakdown, drivers, next-best-fix | Computed, has history |

## 3. Functional areas (map these to pages)

### A. Onboarding
- Create business (name required; location/phone/owner contact optional but
  required before the weekly loop will run).
- Owner verification: send a 6-digit SMS code, confirm it. Nothing in the
  weekly loop runs until this is done — it's the consent gate.
- Connect platforms (see §4).

### B. Dashboard home / operator snapshot
One read endpoint (`get_operator_snapshot`) already aggregates: score,
connections, pending approvals, pending boosts, unresolved reviews, recent
agent actions. This is naturally a single overview page.

### C. Visibility Score
- Current score + category breakdown + drivers + "next best fix"
  (`get_visibility_score`).
- Manual recompute (`run_visibility_audit`) — score is otherwise computed by
  the weekly job.
- History/trend over time, for a line chart (`get_visibility_score_history`).

### D. Content
- **Queue**: `queue_content` generates this week's drafts and fires
  approvals — no manual compose UI exists today (that's a real gap, see §6).
- **Pending approvals**: items waiting on the owner's SMS/email reply
  (`get_pending_approvals`).
- **Calendar**: everything queued/approved/edited but not yet posted, by
  planned date (`get_content_calendar`).
- **Published posts**: the real per-platform outcome of dispatch — link/ID on
  success, real error on failure (`get_post_status`). This is the page that
  answers "did it actually post."
- **Performance**: ranks posted content by an engagement score, diffs top vs.
  bottom performers to surface what's working (`analyze_content_performance`).
- **Trending**: flags posts trending right now vs. their own baseline
  (`flag_trending_content`).
- **Draft score prediction**: scores an unposted draft against historical
  performance before it goes out (`predict_draft_score`).
- **Platform breakdown**: aggregate performance (count, avg score,
  views/clicks/engagement) per platform, ranked (`get_platform_breakdown`).

### E. Boosts (organic → paid)
- `propose_boost`: evaluates recent posts against a threshold; if met,
  requests owner approval to launch a real (paused, never auto-live) Meta/
  Google ad. Surfaced today only via the "Pending boosts" card — a full
  boost-history/detail page doesn't exist yet.

### F. Distribution / connections
- Per-platform connection status (`get_connection_health`): verified /
  sandbox / partner_gated / stub / expired / missing_permissions / etc.
  This status taxonomy is exactly what a "platform health" page should
  visualize — not just connected/not-connected.
- Credentials: look up which fields a platform needs, then save them
  (`set_platform_credentials` — values never echoed back, by design).
- Listing sync: pushes canonical name/address/phone to connected platforms,
  currently GBP only (`sync_listing_info`).

### G. Reputation
- Sentiment trend: rolling 30-day avg rating/review count from stored
  reviews (`capture_sentiment_trend`).
- Duplicate-listing check: flags competing/duplicate GBP listings
  (`check_duplicate_listings`).
- Unresolved reviews surfaced on the dashboard home snapshot.

### H. Competitors
- Add a competitor (name + optional GBP place id) (`add_competitor`).
- Capture a fresh rating/review snapshot per tracked competitor via Google
  Places (`capture_competitor_snapshots`).
- List tracked competitors with their latest snapshot
  (`get_tracked_competitors`). No comparison/diff page against your own score
  exists yet — that's a natural one to design.

### I. Local search
- Track rank for a keyword (defaults to business name) (`track_rank`). No
  rank-history page exists yet (single point-in-time today).

### J. SEO
- NAP completeness/citation audit, scored 0-100 with gaps flagged
  (`run_seo_audit`). One-shot today, no history.

### K. Revenue / leads
- Revenue-by-platform: calls, form fills, bookings, Stripe revenue grouped by
  attributed platform (`get_revenue_by_platform`). Fed by real Stripe and
  generic CRM/form/booking/call webhooks (`/webhooks/stripe`, `/webhooks/crm`)
  — this is real attribution data, not estimated.

## 4. Platform credentials model (important for the "connect platform" flow)

Each platform needs specific fields, looked up dynamically
(`GET /platforms/:platform/credential-fields`):
- Most platforms: a single `${platform}_access_token`.
- Facebook: `fb_page_access_token` + `fb_page_id`.
- Instagram: `fb_page_access_token` (shared with Facebook) + `ig_business_id`.
- GBP: `gbp_access_token` + `gbp_refresh_token` + `gbp_location_id`.
- WhatsApp: access token + phone_number_id + broadcast_recipient.
- WeChat: access token + official_account_id.
- Generic/long-tail platforms (the ~80 without a bespoke integration): an
  `${platform}_id` + `${platform}_access_token` pair, but posting through
  these is currently a stub (see §6) — the UI should visibly distinguish
  "real integration" platforms from "stub" platforms so users don't think
  they're live when they're not.

## 5. Platform integration status (for an honest connections page)

| Tier | Platforms | Behavior |
|---|---|---|
| **Verified** | Facebook, Instagram | Real Graph API calls, confirmed working live |
| **Sandbox** (real code, unconfirmed live) | GBP, YouTube, and most of the ~20 bespoke adapters (Pinterest, Twitter/X, LinkedIn, TikTok, Threads, Yelp, Nextdoor, Snapchat, WhatsApp, Reddit, Bluesky, Mastodon, Tumblr, WeChat, Telegram, Discord, Medium, VK, Line, Vimeo, Flickr, Foursquare, Bing, Apple Business, Houzz, Angi, Thumbtack, Tripadvisor, OpenTable, Quora, Trustpilot, Yandex) | Real HTTP calls against real APIs, but not yet proven against live credentials in production |
| **Stub** (~80 platforms) | Everything else in the generic adapter | No network call at all today — fabricates a fake post ID, returns zero stats. A UI should either hide these or label them clearly "not yet integrated," not "connected" |

## 6. Known gaps to design around, not silently paper over

- **No manual "compose and post now"** — content only originates from the
  automated weekly queue. If the product needs ad-hoc posting, that's a new
  flow, not an existing one.
- **No per-customer auth** — one shared API key drives every business. A
  real multi-tenant UI needs real accounts; today "switching business" is
  just changing an ID, not switching identity/permissions.
- **No boost history page** — boosts exist only as a pending-queue concept.
- **No rank-history or SEO-audit-history** — both tools are single-snapshot.
- **Package tiers (Local Operator / Vertical Pro / Agency / Franchise) don't
  actually change behavior** — any tier selector in a new UI would need real
  feature gating built behind it first, or it shouldn't be shown as if it
  already works.
- **~80 platforms are stubbed** — don't design a UI that implies they post
  for real.

## 7. Suggested page map (derived directly from the above, not invented)

1. **Onboarding** — create business → owner verification → connect platforms
2. **Dashboard** — operator snapshot (score, connections, approvals, boosts, reviews, recent actions)
3. **Visibility Score** — current + drivers + history chart
4. **Content** — sub-tabs: Calendar, Pending Approvals, Published Posts, Performance, Trending, Draft Predictor
5. **Platforms** — connection health + credential setup, tiered by integration status (§5)
6. **Boosts** — pending + (new) history
7. **Reputation** — sentiment trend, duplicate listings, unresolved reviews
8. **Competitors** — tracked list + snapshots + (new) comparison vs. own score
9. **Local Search & SEO** — rank tracking + SEO audit, both currently single-snapshot
10. **Revenue** — by-platform attribution from real webhook data
11. **Settings** — business profile, posting cadence, owner contact info
