# Connect — MightyMax Distribution Layer
## Full Product & Functionality Report

---

## 1. Product Overview

**Connect** is the Distribution Layer of the MightyMax Visibility Engine — a backend
service that automates local-business social/listing presence end-to-end:

1. **Generate** platform-tailored content (copy + image/video) with AI.
2. **Get owner approval** via SMS or email before anything goes live.
3. **Post organically** across **108 platforms**.
4. **Measure performance** and, when a post overperforms, **prompt the owner to
   boost it with paid ads** (Meta/Google Ads), launching real (paused) campaigns.
5. **Close the loop** with reviews: incoming reviews from Reach feed back into
   content generation, reply drafting, and sentiment tracking.
6. **Continuously audit** the business's broader local-search health (SEO, NAP
   consistency, competitors, rankings, duplicate listings, and 18 lightweight
   service-module signals).

It is built **standalone**, integrating with sibling products (**MotionBlue**,
**TurboAd**, **Reach**) only through clearly isolated module boundaries — Connect
owns no UI; it is a set of cron jobs and two inbound webhooks sitting on top of a
shared Supabase (Postgres) database.

---

## 2. Architecture at a Glance

```
                 ┌────────────────────┐
   Reach review─▶│ reach-integration  │
   webhook       └─────────┬──────────┘
                            ▼
   ┌─────────────┐   ┌──────────────┐   ┌────────────┐   ┌───────────────┐
   │content-engine│──▶│  approval    │──▶│distribution│──▶│  performance  │
   │ (AI: copy +  │   │ (SMS/email,  │   │ (108       │   │ (insights     │
   │  media)      │   │  YES/NO/EDIT)│   │ platforms) │   │  polling)     │
   └─────────────┘   └──────────────┘   └─────┬──────┘   └──────┬────────┘
                                               │                  ▼
                                               │           ┌──────────────┐
                                               │           │trigger-engine│
                                               │           │(boost logic) │
                                               │           └──────┬───────┘
                                               ▼                  ▼
                                         ┌───────────┐     ┌───────────┐
                                         │  reporting │◀────│    ads    │
                                         │ (weekly    │     │ (Meta/    │
                                         │  digest)   │     │  Google)  │
                                         └───────────┘     └───────────┘

   Independent always-on audit track:
   seo-audit · competitor-monitor · listings · rank-tracker ·
   sentiment-tracker · duplicate-listing-check · 12 service-modules-12
```

Everything is driven by three cron entrypoints plus one HTTP server:

| Entrypoint | Trigger | What it does |
|---|---|---|
| `npm run weekly` (`src/jobs/weeklyBatch.ts`) | scheduled, weekly | generate → request approval → resolve timeouts → post approved → send report |
| `npm run collect` (`src/jobs/collectPerformance.ts`) | scheduled, frequent | poll insights for all businesses → evaluate boost triggers |
| `npm run services` (`src/jobs/runServiceModules.ts`) | scheduled | run all 18 audit/service modules for every business |
| `npm run dev` (`src/index.ts`) | always-on HTTP server | Twilio inbound SMS webhook, Reach review webhook |

---

## 3. Platform Coverage — 108 Platforms

Connect posts organically to **108 platforms**, each behind its own adapter module
in `src/distribution/`. They fall into three coverage tiers:

### Tier 1 — Bespoke adapters (36 platforms, Phases 1–11)
Fully hand-built integrations with platform-specific request shapes, auth
models, and insight-fetching logic: **GBP, Facebook, Instagram, Pinterest,
X/Twitter, LinkedIn, Threads, Yelp, Nextdoor, Snapchat, TikTok, YouTube,
WhatsApp, Reddit, Bluesky, Mastodon, Tumblr, WeChat, Telegram, Discord, Medium,
VK, LINE, Vimeo, Flickr, Foursquare, Bing Places, Apple Business Connect,
Houzz, Angi, Thumbtack, Tripadvisor, OpenTable, Quora, Trustpilot, Yandex
Business**.

Notable per-platform design decisions:
- **TikTok / YouTube** route through video generation (`generateVideo()`,
  fal.ai kling-video) instead of the static-image path.
- **WhatsApp** has no public feed — "posting" is a broadcast message to an
  opt-in customer list via the Cloud API.
- **Bluesky** authenticates via app password rather than OAuth (Bluesky's
  third-party OAuth was still rolling out).
- **Mastodon** is federated — each business supplies its own instance URL.
- **Threads** requires a separate Threads-scoped token from the IG Graph token.
- Ads, GBP Local Posts, and several partner-program surfaces (Yelp, Nextdoor,
  Houzz, Angi, Thumbtack) are flagged as needing confirmation once partner API
  access is formally granted.

### Tier 2 — Generic stub adapters (72 platforms, Phase 12)
A single config-driven factory (`src/distribution/genericAdapter.ts`) produces
`postTo`/`fetchInsights` pairs for 72 additional directory, marketplace,
delivery, travel, and regional-social platforms: **Weibo, Xiaohongshu,
Kakaotalk, Naver, Baidu, Douyin, Kuaishou, Weverse, Signal, Viber, Kik, Skype,
Slack, Meetup, Eventbrite, Craigslist, Indeed, Glassdoor, Capterra, G2,
ProductHunt, Behance, Dribbble, DeviantArt, 500px, Unsplash, SoundCloud,
Spotify, Apple Podcasts, Google Podcasts, Anchor, Substack, Ghost, WordPress,
Blogger, Weebly, Wix, Squarespace, Etsy, Amazon, Shopify, Walmart, Target,
Instacart, DoorDash, Uber Eats, Grubhub, Postmates, Zomato, Swiggy, Just Eat,
Deliveroo, Booking.com, Expedia, Airbnb, Vrbo, Hotels.com, Kayak, Agoda,
Trivago, Hostelworld, Couchsurfing, Meituan, Dianping, Gaode, Here, MapQuest,
Waze, Alibaba, Tmall, eBay, Naver Blog**.

These are **intentionally honest stubs**: `postTo` validates the business is
connected and returns a synthetic post ID without a real network call;
`fetchInsights` returns zeros — same pattern already used for platforms with no
real analytics API (e.g. Discord). This was a deliberate engineering trade-off
given the scale (72 platforms with no distinct, confirmed integration
requirements) rather than 72 near-duplicate bespoke files.

Every platform — Tier 1 or Tier 2 — has a corresponding pair of `Business`
columns (`<platform>_id`, `<platform>_access_token`/equivalent) gating whether
a business is "connected" to it.

---

## 4. Content Generation (AI) — `src/content-engine`

`connectedPlatforms()` determines which of the 108 platforms a business posts
to, based on populated connection fields. `queueWeeklyContent` and
`queueReviewTriggeredContent` fan out content generation per connected
platform.

**18 AI capabilities**, in three waves:

| Wave | Capabilities |
|---|---|
| Core (Phase 1–8) | platform-tailored caption + image/video generation (DeepSeek copy, fal.ai media) |
| Phase 9 | SEO hashtag generation, multi-language translation (driven by `preferred_language`), sentiment-aware tone adjustment for review-triggered copy |
| Phase 11 | image alt-text generation (accessibility/SEO), trending-topic seeding for weekly content, AI-drafted review-reply suggestions |
| **Phase 12 (new)** | emoji-density tuning, CTA-line generation, headline/title generation, A/B subject-line generation, local-SEO keyword suggestions, accessibility-length trimming, posting-time-of-day suggestions, competitor-differentiation angle suggestion, FAQ-snippet generation, urgency-phrase generation, long-form expansion (for blog platforms), review-reply tone refinement |

All AI calls run through DeepSeek for text and fal.ai for media. Each
content item also now carries a **second caption variant** (`caption_variant_b`
/ `captionVariantB`), generated alongside the primary caption — content can be
A/B-tested per post. `PLATFORM_BRIEF` provides per-platform copy guidance for
the 36 Tier-1 platforms, falling back to a generic brief for the 72 Tier-2
platforms.

---

## 5. Approval Workflow — `src/approval`

- Sends an approval request (SMS via Twilio, or email) per content item.
- Parses owner replies: **YES** (approve), **NO** (reject), **EDIT** (manual
  revision) for content; **BOOST YES/NO** for paid-boost prompts.
- Each request carries a `timeout_action` (`auto_post` or `hold`) so
  unanswered requests resolve automatically per business policy.

---

## 6. Distribution — `src/distribution`

`index.ts` dispatches each approved content item to every platform it targets.
Dispatch order: explicit Tier-1 adapter → Tier-2 generic-adapter fallback. Each
created `post` row now also tracks the doubled metric set: `views`, `clicks`,
`calls`, `engagement`, plus **`impressions`** and **`shares`** (Phase 12),
defaulted to 0 at creation and updated where adapters report real values.

---

## 7. Performance & Boost Loop

- **`src/performance`** polls each connected platform's insights/analytics API
  (or returns zeros for platforms without one) for every posted item.
- **`src/trigger-engine`** evaluates posted content against a views/engagement
  threshold (`VIEWS_THRESHOLD`/`ENGAGEMENT_THRESHOLD`) and prompts the owner,
  via the approval channel, to approve a paid boost.
- **`src/ads`**:
  - `creative.ts` generates ad copy/images from a high-performing organic post
    (reimplements TurboAd's DeepSeek/fal.ai pattern directly, since TurboAd
    exposes no callable API).
  - `metaAds.ts` / `googleAds.ts` launch **real campaigns in `PAUSED` status**
    via the Meta Marketing API and Google Ads API — nothing spends until a
    human activates it in-platform.

---

## 8. Review Feedback Loop — `src/reach-integration`

Handles inbound Reach review webhooks: stores each review and, for positive
reviews with text (rating ≥ `MIN_RATING_FOR_CONTENT`), queues review-triggered
content generation — closing the loop from "customer says something nice" to
"new social post within the week."

---

## 9. Reporting — `src/reporting`

Builds and sends a weekly owner-facing digest: content posted, performance
summary, and any boost/ad activity that occurred.

---

## 10. Local-Search Health & Audit Modules — 18 modules

### Established modules (Phase 10–11, 6 modules, each with a dedicated table)
| Module | Function |
|---|---|
| `src/seo-audit` | Local SEO/citation completeness audit (`runSeoAudit`), 0–100 score. Phase 12 expanded check coverage from 5 to 11 checks (Facebook/Instagram connection, preferred language, ad account, Yelp, GBP refresh token added), with rebalanced scoring. |
| `src/competitor-monitor` | Tracks named competitors (`addCompetitor`) and captures rating/review-count snapshots over time via Google Places API. |
| `src/listings` | Syncs canonical NAP info out to connected platforms (`syncListingInfo`) — GBP today via the Business Information API. |
| `src/rank-tracker` | Tracks local-search keyword rank (`trackRank`) via Places Text Search. |
| `src/sentiment-tracker` | Captures rolling 30-day avg-rating/review-count snapshots from stored Reach reviews. |
| `src/duplicate-listing-check` | Flags potential duplicate/competing GBP listings via name-matching Places Text Search. |

### New lightweight modules (Phase 12, 12 modules, shared `service_signal` table)
Rather than one bespoke table per module, these 12 write generic
`(business_id, module, signal, value, captured_at)` rows to a single
`service_signal` table:

`business-hours-consistency`, `social-proof-badge`, `structured-data`,
`page-speed`, `backlink-count`, `local-citation-count`,
`social-follower-count`, `review-response-rate`, `content-freshness`,
`duplicate-review-flag`, `image-alt-coverage`, `mobile-friendliness`.

All 18 modules run together via `npm run services`
(`src/jobs/runServiceModules.ts`).

---

## 11. Data Model (Supabase / Postgres) — Highlights

| Table | Purpose |
|---|---|
| `business` | One row per client business — 108 × 2 platform connection columns, owner contact info, ad account IDs, `preferred_language`. |
| `content_item` | Generated content awaiting/after approval; now includes `caption_variant_b`. |
| `approval_request` | SMS/email approval requests + parsed responses + timeout policy. |
| `post` | One row per platform per posted content item; metrics now include `impressions`/`shares`. |
| `boost_trigger` | Threshold-met events, owner boost response, ad campaign linkage. |
| `review` | Stored Reach reviews, with AI-suggested replies. |
| `competitor` / `competitor_snapshot` | Competitor tracking. |
| `seo_audit_result`, `rank_snapshot`, `sentiment_trend`, `duplicate_listing_flag`, `listing_sync_result` | Per-module Phase 10/11 results. |
| `service_signal` | Generic signal store backing the 12 Phase 12 modules. |

---

## 12. Scale Timeline

| Phase | Platforms | AI capabilities | Service modules |
|---|---|---|---|
| 1–8 | core set | base copy + media gen | — |
| 9 | — | +3 (hashtags, translation, sentiment tone) | — |
| 10 | — | — | 3 (SEO audit, competitor monitor, listings) |
| 11 ("double all") | 18 → 36 | 3 → 6 | 3 → 6 |
| 12 ("triple + double depth") | 36 → **108** | 6 → **18** | 6 → **18**, + 2nd caption variant, impressions/shares, deeper SEO checks |

---

## 13. Known Gaps / Production Readiness Notes

- 72 Tier-2 platforms use **generic stub adapters** — no real API integration
  yet; revisit once each platform's actual API surface and partner-access
  requirements are confirmed.
- Several Tier-1 adapters (GBP Local Posts, Yelp/Nextdoor partner surfaces,
  TikTok PUBLIC_TO_EVERYONE posting, Apple Business Connect/Angi/Thumbtack/Houzz
  endpoints) await formal partner API access for full confirmation.
- No retry/backoff on external API calls yet.
- Boost thresholds and default ad budget are fixed constants, not yet
  per-business configurable.
- No onboarding UI — `business` rows (tokens, ad account IDs, contact info)
  are seeded manually today.
- Hashtag generation and translation are each a separate DeepSeek call per
  content item — could be batched if cost/latency becomes a concern at scale.
- Meta/Google Ads campaigns launch `PAUSED` by design; full auto-activation is
  a future consideration.

---

*Generated from the current state of the `turbial/connect` repository,
branch `claude/vigilant-goodall-iuindd`.*
