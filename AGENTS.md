# AGENTS.md — Connect

**Messenger entry point.** Routes commands from Slack, Telegram, Teams, email/SMS into the platform. User says "Follow up with John" → classifies intent → routes to CRM/MightyFlow/Result.

## Architecture

- **Docker container** on openclaw-staging
- **Ports:** Webhook server on 3080, Agent API on 8787
- **Domain:** `connect.turbial.com` (Caddy proxy — 3080 root, 8787 under /api/)
- **DB:** Shared Supabase (schema already migrated, tables empty)
- **Stack:** Node.js/Express

## Rules

1. **Connect is the router, not the brain.** It classifies intent and routes — it doesn't process documents, run workflows, or manage contacts.
2. **All routing rules in mighty-core/messenger** — the command parser lives in the shared lib so other services can use it too.
3. **Webhook → classify → route.** Never execute business logic here.

## What NOT to touch

- Twilio, Google Business Profile, or other provider credentials (not set yet — all routes will fail without them)
- The webhook schema on port 3080 without testing both directions (inbound + response)

## Deployment

```bash
docker compose up -d                  # Start container
docker compose logs -f connect        # Watch logs
```

## Missing Env Vars
The container is running but most routes will fail. Missing: Twilio, GBP credentials, Stripe. Only Supabase + API key are set.
