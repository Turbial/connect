# Connect — MightyMax Distribution Layer

The MightyMax Visibility Engine's Distribution Layer: organic posting across 18
platforms (GBP, Facebook, Instagram, Pinterest, X, LinkedIn, Threads, Yelp, Nextdoor,
Snapchat, TikTok, YouTube, WhatsApp, Reddit, Bluesky, Mastodon, Tumblr, WeChat) with
SMS/email owner approval, an organic → paid boost trigger with real Meta/Google Ads
campaign launch, and a review → content feedback loop fed by Reach.
Built standalone — integration with MotionBlue, TurboAd, and Reach is isolated behind
clear module boundaries below.

## Services

| Module | Responsibility |
|---|---|
| `src/content-engine` | Generates platform-tailored post copy + images/videos (DeepSeek + fal.ai). `connectedPlatforms()` determines which platforms a business posts to; `queueWeeklyContent` and `queueReviewTriggeredContent` (Phase 4) both fan out per-platform. TikTok/YouTube route through `generateVideo()` (fal.ai kling-video text-to-video) instead of the static-image path. Phase 9 adds SEO-optimized hashtag generation (`generateHashtags`, for platforms whose brief calls for hashtags), multi-language translation (`translateCaption`, driven by `business.preferred_language`), and sentiment-aware tone adjustment for review-triggered copy (`sentimentTone`, driven by the triggering review's star rating). |
| `src/approval` | Sends SMS (Twilio) or email and parses content YES/NO/EDIT replies (`index.ts`/`sms.ts`/`email.ts`) and boost BOOST YES/NO replies (`boost.ts`). |
| `src/distribution` | Posts approved content across all 18 connected platforms. Each platform's API calls are isolated behind its own adapter (`gbp.ts`, `meta.ts`, `pinterest.ts`, `twitter.ts`, `linkedin.ts`, `threads.ts`, `yelp.ts`, `nextdoor.ts`, `snapchat.ts`, `tiktok.ts`, `youtube.ts`, `whatsapp.ts`, `reddit.ts`, `bluesky.ts`, `mastodon.ts`, `tumblr.ts`, `wechat.ts`); `index.ts` dispatches per item per platform. |
| `src/performance` | Polls each connected platform's insights/analytics API for posted items. |
| `src/trigger-engine` | Evaluates posted content against a views/engagement threshold and prompts the owner to approve a paid boost (Phase 3). |
| `src/ads` | `creative.ts` generates ad copy/images from a high-performing organic post (TurboAd exposes no callable API, so this reimplements its DeepSeek/fal.ai pattern directly). `metaAds.ts`/`googleAds.ts` launch real, paused campaigns via the Meta Marketing API and Google Ads API. |
| `src/reach-integration` | Handles inbound Reach review events: stores the review and, for positive reviews with text, queues review-triggered content (Phase 4). |
| `src/reporting` | Builds and sends the weekly owner-facing digest, including boost/ad activity. |
| `src/seo-audit` | Phase 10: runs a local SEO/citation completeness audit (`runSeoAudit`) against the business's own NAP record, scoring it 0-100 and flagging gaps. |
| `src/competitor-monitor` | Phase 10: tracks named competitors per business (`addCompetitor`) and captures rating/review-count snapshots over time via the Google Places API (`captureCompetitorSnapshots`). |
| `src/listings` | Phase 10: syncs the business's canonical NAP info out to connected platforms' profiles (`syncListingInfo`), starting with GBP's Business Information API. |
| `src/jobs/weeklyBatch.ts` | Cron entrypoint: generate → request approval → resolve timeouts → post approved → send report. |
| `src/jobs/collectPerformance.ts` | Cron entrypoint: poll insights for all businesses, then evaluate boost triggers. |
| `src/jobs/runServiceModules.ts` | Cron entrypoint: runs the SEO audit, competitor snapshot capture, and listing sync for all businesses (`npm run services`). |
| `src/index.ts` | HTTP server for Twilio's inbound SMS webhook (`/webhooks/sms`, disambiguating content vs. boost replies) and Reach's review webhook (`/webhooks/reach-review`). |

## Setup
1. Copy `.env.example` to `.env` and fill in Supabase, Twilio, DeepSeek, fal.ai, Meta,
   Google Ads, Pinterest/X/LinkedIn, Threads/Yelp/Nextdoor/Snapchat, and Reach email
   webhook credentials.
2. Run `db/schema.sql` against your Supabase project.
3. `npm install`
4. `npm run weekly` to run the weekly batch job manually, or wire it to a scheduler.
5. `npm run collect` to poll performance and evaluate boost triggers.
6. `npm run services` to run the SEO audit, competitor snapshot capture, and listing sync.
7. `npm run dev` to start the webhook server.

## Known gaps to resolve before production
- Hashtag generation (`generateHashtags`) and translation (`translateCaption`) are each
  a separate DeepSeek call per content item, on top of the base caption call — this
  roughly triples DeepSeek usage for businesses with `preferred_language` set and
  platforms in `HASHTAG_PLATFORMS`. Worth batching into a single structured-output
  call if DeepSeek cost/latency becomes a concern at scale.
- Sentiment-aware tone (`sentimentTone`) only has signal for ratings >= `MIN_RATING_FOR_CONTENT`
  (4) today, since `reach-integration/index.ts` only queues content for positive reviews —
  the "matter-of-fact" branch for lower ratings is unreachable in practice but kept as a
  safe default in case that filter changes.
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
- TikTok's adapter (`tiktok.ts`) uses the Content Posting API's `PULL_FROM_URL` init
  flow against the fal.ai-hosted video URL; this requires the app to be out of
  TikTok's sandbox/audit review before `PUBLIC_TO_EVERYONE` posts are allowed —
  confirm once developer access is granted.
- YouTube's adapter (`youtube.ts`) uploads via the Data API v3 resumable upload
  endpoint; Shorts classification is automatic based on the video's own aspect
  ratio/duration, but daily upload quota usage should be monitored once live.
- fal.ai's kling-video text-to-video model used for TikTok/YouTube is meaningfully
  slower and costlier than image generation — worth revisiting if video volume
  grows enough to matter for cost or batch-job duration.
- X media upload uses the legacy v1.1 endpoint since v2 has no direct image upload;
  revisit if X deprecates it.
- LinkedIn's `postToLinkedin` reads the created post's URN from the `x-restli-id`
  response header per the documented UGC Posts API behavior — confirm against a live
  org page once LinkedIn API access is granted.
- Yelp and Nextdoor adapters (`yelp.ts`, `nextdoor.ts`) target their respective
  partner-program "business updates"/"business posts" surfaces, which aren't fully
  public — confirm exact endpoints/auth once partner access is granted for each.
- Threads (`threads.ts`) uses a Threads-scoped access token, issued separately from
  the Instagram Graph token even though both are Meta products — don't assume
  `fb_page_access_token` works for Threads calls.
- WhatsApp (`whatsapp.ts`) has no public feed concept, so "posting" is a broadcast
  message to the business's existing opt-in customer list via the Cloud API; insights
  return zeros until a delivery/read status-webhook ingestion path is built.
- Reddit (`reddit.ts`) posts to a single configured subreddit per business — this
  assumes the business (or its agency account) already has posting permissions
  there; community-specific posting rules aren't validated before submission.
- Bluesky (`bluesky.ts`) authenticates via per-business app password
  (`createSession`) rather than OAuth, since Bluesky's third-party OAuth flow was
  still rolling out when this adapter was written — revisit once it's stable.
- Mastodon (`mastodon.ts`) is federated, so each business's `mastodon_instance_url`
  is used as the API base instead of a single shared host.
- WeChat (`wechat.ts`) targets the Official Account draft → freepublish flow, which
  requires a verified service account in mainland China — confirm account tier
  requirements once WeChat platform access is pursued.
- `src/seo-audit`'s audit only checks the business's own NAP record completeness,
  not what's actually live on each platform's listing — a true citation-consistency
  audit (comparing our record against each platform's current listing) would need a
  read API per platform, same confirmation caveat as every distribution adapter.
- `src/listings`' `syncListingInfo` only syncs GBP today; most other platforms don't
  expose a stable, publicly documented business-info update endpoint usable without
  partner access — extend platform-by-platform as those are confirmed.
- `src/competitor-monitor` only tracks GBP-based competitors (via Places API place
  id); competitors without a Google Business Profile aren't trackable yet.
