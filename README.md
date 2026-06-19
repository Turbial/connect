# Connect — MightyMax Distribution Layer

The MightyMax Visibility Engine's Distribution Layer: organic posting (GBP, Facebook,
Instagram, Pinterest, X, LinkedIn) with SMS/email owner approval, an organic → paid
boost trigger with real Meta/Google Ads campaign launch, and a review → content
feedback loop fed by Reach. Built standalone — integration with MotionBlue, TurboAd,
and Reach is isolated behind clear module boundaries below.

## Services

| Module | Responsibility |
|---|---|
| `src/content-engine` | Generates platform-tailored post copy + images (DeepSeek + fal.ai). `connectedPlatforms()` determines which platforms a business posts to; `queueWeeklyContent` and `queueReviewTriggeredContent` (Phase 4) both fan out per-platform. |
| `src/approval` | Sends SMS (Twilio) or email and parses content YES/NO/EDIT replies (`index.ts`/`sms.ts`/`email.ts`) and boost BOOST YES/NO replies (`boost.ts`). |
| `src/distribution` | Posts approved content to GBP, Facebook Pages, Instagram, Pinterest, X, and LinkedIn. Each platform's API calls are isolated behind its own adapter (`gbp.ts`, `meta.ts`, `pinterest.ts`, `twitter.ts`, `linkedin.ts`); `index.ts` dispatches per item per platform. |
| `src/performance` | Polls each connected platform's insights/analytics API for posted items. |
| `src/trigger-engine` | Evaluates posted content against a views/engagement threshold and prompts the owner to approve a paid boost (Phase 3). |
| `src/ads` | `creative.ts` generates ad copy/images from a high-performing organic post (TurboAd exposes no callable API, so this reimplements its DeepSeek/fal.ai pattern directly). `metaAds.ts`/`googleAds.ts` launch real, paused campaigns via the Meta Marketing API and Google Ads API. |
| `src/reach-integration` | Handles inbound Reach review events: stores the review and, for positive reviews with text, queues review-triggered content (Phase 4). |
| `src/reporting` | Builds and sends the weekly owner-facing digest, including boost/ad activity. |
| `src/jobs/weeklyBatch.ts` | Cron entrypoint: generate → request approval → resolve timeouts → post approved → send report. |
| `src/jobs/collectPerformance.ts` | Cron entrypoint: poll insights for all businesses, then evaluate boost triggers. |
| `src/index.ts` | HTTP server for Twilio's inbound SMS webhook (`/webhooks/sms`, disambiguating content vs. boost replies) and Reach's review webhook (`/webhooks/reach-review`). |

## Setup
1. Copy `.env.example` to `.env` and fill in Supabase, Twilio, DeepSeek, fal.ai, Meta,
   Google Ads, Pinterest/X/LinkedIn, and Reach email webhook credentials.
2. Run `db/schema.sql` against your Supabase project.
3. `npm install`
4. `npm run weekly` to run the weekly batch job manually, or wire it to a scheduler.
5. `npm run collect` to poll performance and evaluate boost triggers.
6. `npm run dev` to start the webhook server.

## Known gaps to resolve before production
- `src/distribution/gbp.ts` targets the legacy Local Posts endpoint as a placeholder.
  Confirm the current Business Profile API surface once GBP API access is granted
  (this has external approval lead time, same as Google Ads developer token approval).
- Meta/Google Ads campaigns are launched in `PAUSED` status by design — nothing spends
  money until a human reviews and activates the campaign in-platform. Revisit once
  there's appetite for fully automatic activation.
- No retry/backoff on external API calls yet.
- Boost threshold (`VIEWS_THRESHOLD`/`ENGAGEMENT_THRESHOLD` in `trigger-engine/index.ts`)
  and default boost budget (`DEFAULT_BUDGET_CENTS` in `approval/boost.ts`) are fixed
  constants; no per-business configuration yet.
- `business` rows (platform tokens, ad account ids, owner contact info) are assumed to
  be seeded manually; no onboarding UI exists.
- TikTok and YouTube are still not covered — both are video-first platforms and the
  Content Engine only generates static images today. Adding them needs a video
  generation/sourcing step before an adapter would be useful.
- X media upload uses the legacy v1.1 endpoint since v2 has no direct image upload;
  revisit if X deprecates it.
- LinkedIn's `postToLinkedin` reads the created post's URN from the `x-restli-id`
  response header per the documented UGC Posts API behavior — confirm against a live
  org page once LinkedIn API access is granted.
