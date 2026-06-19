# Connect — Development Program

Derived from the Product Completeness & Category Leadership Assessment.
This is the actionable build plan: what gets built, in what order, and why.

## Operating Principle

> Stop multiplying surface area. Prove the core loop. Let the agent layer scale it.

Every task below exists to serve one of three goals, in priority order:
1. **Truth** — stop misrepresenting what the system actually does.
2. **Reliability** — make the narrow real core trustworthy enough to run unsupervised.
3. **Outcomes** — prove calls/leads/revenue, not impressions.

No new platforms, no new AI capabilities, no new service modules until Phase 1 and
Phase 2 are done. Breadth work is frozen.

---

## Phase 1 — Truth & Reliability (Days 1–30)

**Goal:** every claim the system makes about itself is true, and a failed post is
visible instead of silent.

### 1.1 Platform status taxonomy
- Add a `platform_status` enum to the platform-connection model:
  `verified | sandbox | partner_gated | stub | unsupported`.
- Tag all 108 current platforms against this taxonomy (36 Tier-1 adapters get
  individually reviewed and downgraded where partner access / API confirmation
  is still pending; all 72 Tier-2 generic adapters get tagged `stub`).
- Distribution dispatch and reporting both read this status field.

### 1.2 Stop reporting fake activity
- `postToPlatform`/generic adapter: a `stub`-status platform must not write a
  `post` row that reporting treats as a successful publish. Either skip
  dispatch entirely for `stub`/`unsupported` platforms, or write the row with
  a `status: "not_active"` marker that the weekly digest and any future
  dashboard explicitly filter out.
- Weekly digest (`src/reporting`): only count/list posts where the target
  platform's status is `verified` (or `sandbox` for internal/pilot accounts
  explicitly flagged as such).
- Audit `connectedPlatforms()` so a business is only treated as "posting to N
  platforms" for platforms that are actually `verified`.

### 1.3 Reliability primitives
- Add retry-with-exponential-backoff wrapper for all outbound platform/API
  calls (distribution, performance polling, ads).
- Add an idempotency key per (content_item_id, platform) for post dispatch to
  prevent duplicate live posts on retry.
- Add structured failure logging for every adapter call (platform, business,
  error, timestamp) — queryable, not just thrown/swallowed.

### 1.4 Brand-risk defaults
- Flip `timeout_action` default for new businesses from `auto_post` to `hold`.
  `auto_post` becomes an explicit opt-in, not the default.
- Build a minimal EDIT queue: a table/view of content items in `edited` status
  with the owner's requested change, so EDIT replies resolve to a concrete
  next action instead of disappearing.

### Phase 1 exit criteria
- No stub/unsupported platform ever appears as a completed post in any
  customer-facing report.
- Every post dispatch is retried on transient failure and cannot duplicate.
- Every failure is logged and queryable.
- New businesses default to approval-required, not auto-post.
- EDIT replies land somewhere actionable.

---

## Phase 2 — Front Door & Verified Core (Days 31–60)

**Goal:** a business can be onboarded and kept running without hand-seeding
the database.

### 2.1 Normalize platform connections
- Replace the 108×2 columns on `business` with a `platform_connection` table:
  `id, business_id, platform, account_id, account_name, access_token_ref,
  refresh_token_ref, scopes, status, expires_at, last_verified_at,
  last_posted_at, last_metrics_sync_at, failure_reason, created_at, updated_at`.
- Migrate existing `business.<platform>_id`/`<platform>_access_token` data into
  this table; update every adapter and `connectedPlatforms()` to read from it.

### 2.2 Pick and verify the real core
- Select 5–10 platforms to take to `verified` status end-to-end this phase
  (candidates per the assessment: GBP, Facebook, Instagram, LinkedIn, one of
  TikTok/YouTube Shorts, plus listings/review platforms where access is
  confirmed).
- For each: confirm OAuth flow, confirm posting works, confirm insights
  fetch works, confirm token refresh works, confirm failure visibility works.
- Everything not in this verified set stays `sandbox`/`partner_gated`/`stub`
  and stays out of customer-facing reporting per Phase 1.1.

### 2.3 Onboarding & connection center
- Minimal UI/flow for: business setup, OAuth connect per platform, approval
  channel setup (SMS/email), boost budget/threshold settings, brand voice
  basics.
- Connection center surfaces per platform: connected / missing permissions /
  expired token / failed refresh / last successful post / last metrics sync /
  action required.
- Token expiry monitoring job that flags `platform_connection` rows needing
  reconnection before they silently fail.

### 2.4 Reporting accuracy
- Weekly report explicitly separates: posts published, posts pending, posts
  failed, platforms needing reconnection. No blended "activity" number.

### Phase 2 exit criteria
- A new business can be connected and posting without a developer touching
  the database.
- 5–10 platforms are genuinely `verified` (real OAuth, real posts, real
  metrics, real token refresh).
- Owners can see and fix their own connection problems.

---

## Phase 3 — ROI & Agent Operations (Days 61–90)

**Goal:** reports show business outcomes, and routine exceptions are handled
by agents instead of humans.

### 3.1 Outcome attribution
- UTM-tag every link Connect generates.
- Wire call tracking and form tracking into the post → click → lead chain.
- Pull Reach/CRM lead and booking events keyed to the originating content
  item/post where attributable.
- Where payment data exists (e.g. Stripe), attribute revenue back to the
  originating campaign/post.

### 3.2 Local Visibility Score v1
- Aggregate the 18 audit/service-module signals (`seo-audit`,
  `competitor-monitor`, `listings`, `rank-tracker`, `sentiment-tracker`,
  `duplicate-listing-check`, the 12 `service-modules-12`) into one 0–100
  customer-facing score with a category breakdown (listings, reviews, website
  health, search presence, social activity, content freshness, competitor
  strength, ads readiness, response rate, profile completeness).
- Every score gap maps to a concrete recommended action (not just a number).

### 3.3 Agent-handled exceptions
- EDIT requests get an agent-drafted rewrite attached automatically, with the
  owner approving the rewrite via the existing SMS/email channel rather than
  a human handling it manually.
- Boost flow redesigned to one of two models (decide before building):
  - **Recommendation-only**: owner is notified a post is performing well; no
    campaign object is created until a human/operator acts.
  - **Guardrailed activation**: owner replies with a budget (e.g. "BOOST YES
    $50"); Connect activates the paused campaign with a hard budget/duration
    cap and owner-visible reporting.
- Failure escalation: agent summarizes recurring failures (e.g. repeated
  token expiry for a platform) into the weekly report instead of silent logs.

### Phase 3 exit criteria
- Weekly report includes calls/leads/revenue for at least one fully wired
  attribution path, not just impressions/engagement.
- Local Visibility Score is live for pilot businesses.
- EDIT and boost-activation exceptions resolve without manual developer
  intervention.

---

## Explicitly Deferred (post-90-day, category-leadership track)

Not started until Phases 1–3 are done and the core loop is proven:
- Expanding `verified` platform count beyond the initial 5–10.
- Agency/multi-location data model (organizations, locations, hierarchical
  approvals, white-label, bulk publishing, consolidated billing).
- Distributed worker/queue architecture (Temporal/SQS/BullMQ) — current cron
  jobs are acceptable until volume requires it.
- Two-way customer messaging (missed-call text-back, web chat, DM inbox).
- Brand voice/compliance engine beyond basic settings.
- Partner-facing API (platforms integrating into Connect rather than the
  reverse).

---

## What This Program Explicitly Stops Doing

- No further "double/triple" platform-count expansions.
- No new stub adapters added to the Tier-2 generic factory.
- No new service-signal modules until existing ones drive a recommendation,
  not just a stored row.
- No marketing or reporting language claiming "108 platforms" — internal and
  external copy should say "adapter framework covering 100+ destinations,
  with N platforms fully verified" until the verified count actually grows.
