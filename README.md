# Connect — MightyMax Distribution Layer

Phase 1 of the MightyMax Visibility Engine: GBP-only organic posting with SMS/email
owner approval and a weekly performance report. Built standalone — integration
with MotionBlue, TurboAd, and Reach is deliberately deferred to later phases and
isolated behind clear module boundaries below.

## Services

| Module | Responsibility |
|---|---|
| `src/content-engine` | Generates post copy + images (DeepSeek + fal.ai, same pattern as TurboAd). Standalone today; designed so TurboAd or MotionBlue can supply input later without changing its interface. |
| `src/approval` | Sends SMS (Twilio, new — no two-way SMS exists in Reach's toolkit) or email (reuses Reach's `email.send` via webhook) and parses YES/NO/EDIT replies. |
| `src/distribution` | Posts approved content to GBP. `gbp.ts` isolates the actual Business Profile API calls behind an adapter. |
| `src/performance` | Polls GBP Insights for posted items. |
| `src/reporting` | Builds and sends the weekly owner-facing digest. |
| `src/jobs/weeklyBatch.ts` | Cron entrypoint: generate → request approval → resolve timeouts → post approved → send report. |
| `src/jobs/collectPerformance.ts` | Cron entrypoint: poll GBP Insights for all businesses. |
| `src/index.ts` | HTTP server for Twilio's inbound SMS webhook (`/webhooks/sms`). |

## Explicitly out of scope for Phase 1
- Facebook/Instagram posting (Phase 2)
- Organic → paid boost trigger and TurboAd/Meta-Ads/Google-Ads integration (Phase 3)
- Reach review → content brief trigger (Phase 4)
- Multi-location businesses

## Setup
1. Copy `.env.example` to `.env` and fill in Supabase, Twilio, DeepSeek, fal.ai, and
   Reach email webhook credentials.
2. Run `db/schema.sql` against your Supabase project.
3. `npm install`
4. `npm run weekly` to run the weekly batch job manually, or wire it to a scheduler.
5. `npm run dev` to start the SMS webhook server.

## Known gaps to resolve before production
- `src/distribution/gbp.ts` targets the legacy Local Posts endpoint as a placeholder.
  Confirm the current Business Profile API surface once GBP API access is granted
  (see open question in the original build plan — this has external approval lead time).
- No retry/backoff on external API calls yet.
- `business` rows (GBP tokens, owner contact info) are assumed to be seeded manually
  for Phase 1; no onboarding UI exists.
