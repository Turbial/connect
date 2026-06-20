# Connect — MightyMax Distribution Layer

The MightyMax Visibility Engine's Distribution Layer: organic posting across 108
platforms (GBP, Facebook, Instagram, Pinterest, X, LinkedIn, Threads, Yelp, Nextdoor,
Snapchat, TikTok, YouTube, WhatsApp, Reddit, Bluesky, Mastodon, Tumblr, WeChat,
Telegram, Discord, Medium, VK, LINE, Vimeo, Flickr, Foursquare, Bing Places, Apple
Business Connect, Houzz, Angi, Thumbtack, Tripadvisor, OpenTable, Quora, Trustpilot,
Yandex Business, plus 72 more added in Phase 12 spanning regional social (Weibo,
Xiaohongshu, Douyin, KakaoTalk...), messaging (Signal, Viber, Skype, Slack...),
listings/marketplaces (Etsy, Amazon, Shopify, eBay...), delivery/booking (DoorDash,
Airbnb, Booking.com...), and maps (Waze, HERE, MapQuest...)) with SMS/email owner
approval, an organic → paid boost trigger with real Meta/Google Ads campaign launch,
and a review → content feedback loop fed by Reach. Built standalone — integration
with MotionBlue, TurboAd, and Reach is isolated behind clear module boundaries below.

Phase 12 triples platform coverage (36 → 108), AI capabilities (6 → 18), and service
modules (6 → 18), and doubles per-item richness (a second caption variant per content
item, `impressions`/`shares` on post metrics, and deeper audit/signal checks). The 72
new platforms route through a single generic stub adapter
(`src/distribution/genericAdapter.ts`) rather than 72 bespoke integrations — see Known
gaps below.

## Services

| Module | Responsibility |
|---|---|
| `src/content-engine` | Generates platform-tailored post copy + images/videos (DeepSeek + fal.ai). `connectedPlatforms()` determines which platforms a business posts to; `queueWeeklyContent` and `queueReviewTriggeredContent` (Phase 4) both fan out per-platform. TikTok/YouTube route through `generateVideo()` (fal.ai kling-video text-to-video) instead of the static-image path. Phase 9 adds SEO-optimized hashtag generation (`generateHashtags`, for platforms whose brief calls for hashtags), multi-language translation (`translateCaption`, driven by `business.preferred_language`), and sentiment-aware tone adjustment for review-triggered copy (`sentimentTone`, driven by the triggering review's star rating). Phase 11 adds AI-generated image alt text for accessibility/SEO, trending-idea seeding to keep weekly content topical, and AI-drafted review-reply suggestions (`review.suggested_reply`). Phase 12 adds a second caption variant per post (`generatePost`'s `captionVariantB`, stored as `content_item.caption_variant_b`), a generic `PLATFORM_BRIEF` fallback for the 72 new platforms with no distinct copy needs, and 12 more standalone AI capabilities in `src/content-engine/capabilities.ts` (emoji-density tuning, CTA-line generation, headline generation, A/B subject lines, local-SEO keyword suggestions, accessibility trimming, posting-time suggestions, differentiation-angle suggestions, FAQ-snippet generation, urgency-phrase generation, long-form expansion for blog-style platforms, and review-reply tone refinement). |
| `src/approval` | Sends SMS (Twilio) or email and parses content YES/NO/EDIT replies (`index.ts`/`sms.ts`/`email.ts`) and boost BOOST YES/NO replies (`boost.ts`). |
| `src/distribution` | Posts approved content across all 108 connected platforms. Each of the original 36 platforms' API calls is isolated behind its own adapter (`gbp.ts`, `meta.ts`, `pinterest.ts`, `twitter.ts`, `linkedin.ts`, `threads.ts`, `yelp.ts`, `nextdoor.ts`, `snapchat.ts`, `tiktok.ts`, `youtube.ts`, `whatsapp.ts`, `reddit.ts`, `bluesky.ts`, `mastodon.ts`, `tumblr.ts`, `wechat.ts`, `telegram.ts`, `discord.ts`, `medium.ts`, `vk.ts`, `line.ts`, `vimeo.ts`, `flickr.ts`, `foursquare.ts`, `bing.ts`, `applebusiness.ts`, `houzz.ts`, `angi.ts`, `thumbtack.ts`, `tripadvisor.ts`, `opentable.ts`, `quora.ts`, `trustpilot.ts`, `yandex.ts`); the 72 Phase 12 platforms route through a single generic stub adapter (`genericAdapter.ts`, `createGenericAdapter`/`genericAdapters`) instead. `index.ts` dispatches per item per platform, falling back to `genericAdapters` for any platform without an explicit adapter. |
| `src/performance` | Polls each connected platform's insights/analytics API for posted items. |
| `src/content-analytics` | Ranks a business's posted content by an engagement score (`rankContentPerformance`) and compares the top vs. bottom performers across media type, surface, platform, caption length, posting time, hashtag/emoji use, and A/B caption variant (`diffAttributes`), turning the significant differences into plain-language guidance on what to focus on next (`analyzeContentPerformance`) — answers "why did this post outperform that one, and what should I make more of." |
| `src/trigger-engine` | Evaluates posted content against a views/engagement threshold and prompts the owner to approve a paid boost (Phase 3). |
| `src/ads` | `creative.ts` generates ad copy/images from a high-performing organic post (TurboAd exposes no callable API, so this reimplements its DeepSeek/fal.ai pattern directly). `metaAds.ts`/`googleAds.ts` launch real, paused campaigns via the Meta Marketing API and Google Ads API. |
| `src/reach-integration` | Handles inbound Reach review events: stores the review and, for positive reviews with text, queues review-triggered content (Phase 4). |
| `src/reporting` | Builds and sends the weekly owner-facing digest, including boost/ad activity. |
| `src/seo-audit` | Phase 10: runs a local SEO/citation completeness audit (`runSeoAudit`) against the business's own NAP record, scoring it 0-100 and flagging gaps. |
| `src/competitor-monitor` | Phase 10: tracks named competitors per business (`addCompetitor`) and captures rating/review-count snapshots over time via the Google Places API (`captureCompetitorSnapshots`). |
| `src/listings` | Phase 10: syncs the business's canonical NAP info out to connected platforms' profiles (`syncListingInfo`), starting with GBP's Business Information API. |
| `src/rank-tracker` | Phase 11: tracks a business's local search rank for a keyword (`trackRank`) by Text Search-ing the keyword near the business and locating its own listing in the result order via the Google Places API. |
| `src/sentiment-tracker` | Phase 11: captures a rolling 30-day avg-rating/review-count snapshot (`captureSentimentTrend`) from stored Reach reviews. |
| `src/duplicate-listing-check` | Phase 11: flags potential duplicate/competing Google Business Profile listings (`checkDuplicateListings`) by Text Search-ing the business's own name and name-matching against its known listing. |
| `src/service-modules-12` | Phase 12: 12 additional lightweight service modules (business-hours consistency, social-proof-badge eligibility, structured-data readiness, page-speed signal, backlink-count snapshot, local-citation-count snapshot, social-follower-count snapshot, review-response rate, content-freshness, duplicate-review flag, image-alt-text coverage, mobile-friendliness), each writing one row into the generic `service_signal` table (`module`, `signal`, `value`, `captured_at`) instead of a dedicated table per module. |
| `src/jobs/weeklyBatch.ts` | Cron entrypoint: generate → request approval → resolve timeouts → post approved → send report. |
| `src/jobs/collectPerformance.ts` | Cron entrypoint: poll insights for all businesses, then evaluate boost triggers. |
| `src/jobs/runServiceModules.ts` | Cron entrypoint: runs the SEO audit, competitor snapshot capture, listing sync, rank tracking, sentiment trend capture, duplicate listing check, and the 12 Phase 12 service-signal modules for all businesses (`npm run services`). |
| `src/index.ts` | HTTP server for Twilio's inbound SMS webhook (`/webhooks/sms`, disambiguating content vs. boost replies) and Reach's review webhook (`/webhooks/reach-review`). |
| `src/tools` | Phase 8.10: the typed tool registry (`callTool`/`getToolCatalog`) every agent-facing surface below dispatches through — same dry-run/approval/audit-log behavior for every caller. |
| `src/agent-api` | Phase 10: a minimal bearer-token-authed HTTP API (`GET /tools`, `POST /tools/:name`) exposing the tool registry to any agent able to make HTTP calls (`npm run agent-api`). |
| `src/mcp` | Phase 12: an MCP stdio server (`npm run mcp`) exposing the same tool registry over the Model Context Protocol, so Claude Desktop/Code (or any other MCP client) can attach to Connect directly as a tool-using agent. |
| `src/agent-api/public` | Phase 13: a minimal static operator dashboard (snapshot/score/connections/approvals/boosts/reviews/recent actions, plus actions to queue content, run a visibility audit, evaluate boost triggers, and set platform credentials), served by the agent-api server at `/` and calling its own `/tools/:name` endpoints with an API key entered in the page. Phase 15: adds a "New business" form (`POST /businesses`) and owner-verification send/confirm controls (`POST /businesses/:id/owner-verification/send`/`confirm`), so a business can be created and the owner verified entirely from the dashboard instead of a manual DB insert. |

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
8. `npm run agent-api` to start the agent-facing HTTP API (set `CONNECT_AGENT_API_KEY` first)
   and serve the operator dashboard at `http://localhost:8787/` (enter the same API key and a
   business id in the page), or `npm run mcp` to expose the same tools over MCP for Claude
   Desktop/Code or any other MCP client — point its config at this command with the project's
   env vars set.

## Roadmap

`PHASE_14_SCOPE.md` breaks the content-analytics work (`src/content-analytics`)
into trackable sub-phases — structural diffing (shipped), qualitative caption
analysis, trend/virality detection, predictive draft scoring, and feeding
insights back into content generation.

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
- External post/insight calls already retry with backoff (`src/lib/retry.ts`'s `withRetry`,
  applied in `src/distribution/index.ts` and `src/performance/index.ts`); a failure on one
  platform/post/business is isolated and logged rather than aborting the rest of a cron run
  (`src/jobs/weeklyBatch.ts`, `collectPerformance.ts`, `runServiceModules.ts` each wrap
  per-business work in try/catch).
- Boost threshold and default boost budget are per-business overridable via
  `src/lib/orgSettings.ts`'s `resolveBusinessSetting` (falling back to the
  `VIEWS_THRESHOLD`/`ENGAGEMENT_THRESHOLD`/`DEFAULT_BUDGET_CENTS` constants only when a
  business hasn't set `boost_views_threshold`/`boost_engagement_threshold`/`boost_budget_cents`).
- Creating a business and setting platform credentials/owner verification can now be
  done entirely from the dashboard (Phase 15's "New business" form + owner-verification
  controls), but there's still no per-customer login — every operator action (including
  business creation) is gated by the single shared `CONNECT_AGENT_API_KEY`, not a
  per-customer account. Fine for an agency managing its own clients; a true self-serve
  public signup would need a real multi-tenant user/auth model, which doesn't exist yet.
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
- Exact API endpoints for Apple Business Connect, Angi, Thumbtack, and Houzz are
  inferred from public docs/partner-program descriptions and need verification once
  partner access is granted for each.
- OAuth/auth model varies widely across the 18 Phase 11 platforms (full OAuth client
  id/secret, simple API keys, cert-based signing, channel-scoped secrets, or no
  app-level credential at all) — see `.env.example` for the per-platform breakdown.
- `src/rank-tracker` and `src/duplicate-listing-check` match a business's own listing
  by exact/substring Places id comparison (or name fallback for rank); this is a
  best-effort heuristic and may mis-rank or mis-flag for businesses with very common
  names or unconfirmed GBP listings.
- The 72 Phase 12 platforms (Weibo, Xiaohongshu, Douyin, KakaoTalk, Signal, Viber,
  Slack, Substack, WordPress, Etsy, Shopify, DoorDash, Airbnb, Waze, and the rest —
  see `src/distribution/genericAdapter.ts`) are real platforms, but no bespoke API
  integration has been built or confirmed for any of them yet. Rather than guess at
  72 unconfirmed endpoints, `genericAdapter.ts`'s `createGenericAdapter` returns a
  working stub: it validates the business is connected, returns a synthetic
  `platformPostId` without making a real network call, and reports zero insights —
  same honest-zeros approach as `discord.ts`'s `fetchDiscordInsights`, but because no
  API is confirmed at all rather than a confirmed API with no analytics surface.
  Replace each with a real adapter as API access is confirmed per platform, same
  pattern as every other "needs confirmation" gap above.
- Several of the 12 Phase 12 service modules (`backlink-count`, `page-speed`,
  `mobile-friendliness`) depend on external data providers (Ahrefs/Moz/Semrush,
  Google PageSpeed Insights) that aren't wired up yet — they capture a `null`
  placeholder value until those provider integrations are confirmed, same pattern as
  unconfigured API keys elsewhere in this codebase.
- `src/service-modules-12/local-citation-count` and `social-follower-count` use
  `connectedPlatforms(business).length` as a placeholder signal, since no
  per-platform citation-presence or follower-count read API is confirmed yet — revisit
  once those reads are wired in per platform.
