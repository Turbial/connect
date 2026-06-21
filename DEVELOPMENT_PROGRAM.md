# Connect — Development Program

Derived from the Product Completeness & Category Leadership Assessment.
This is the actionable build plan: what gets built, in what order, and why.

## Operating Principle

> Stop multiplying surface area. Prove the core loop. Let the agent layer scale it.

Every task below exists to serve one of these goals, in priority order:
1. **Truth** — stop misrepresenting what the system actually does.
2. **Reliability** — make the narrow real core trustworthy enough to run unsupervised.
3. **Usability** — remove every step that currently requires a developer (onboarding,
   reconnection, EDIT handling, boost activation).
4. **Adaptability** — let the product flex per business/agency/franchise without
   forking code (settings, brand voice, hierarchy, multi-location).
5. **Outcomes** — prove calls/leads/revenue, not impressions.

No new platforms, no new AI capabilities, no new service modules for their own sake.
Breadth work only resumes once it's in service of usability/adaptability/outcomes
(e.g. "add platform X because a real customer needs it," not "double the count").

---

## Phase 1 — Truth & Reliability (Days 1–30) — ✅ DONE

**Goal:** every claim the system makes about itself is true, and a failed post is
visible instead of silent.

- **1.1 Platform status taxonomy** — `src/lib/platformStatus.ts` tags every
  platform `verified | sandbox | partner_gated | stub | unsupported`.
- **1.2 Stop reporting fake activity** — distribution skips dispatch entirely
  for `stub`/`unsupported` platforms; the weekly digest filters defensively to
  live platforms only.
- **1.3 Reliability primitives** — `withRetry` exponential backoff around all
  platform dispatch, idempotent `post` upsert on `(content_item_id, platform)`,
  failures logged to `distribution_failure` instead of thrown-and-lost.
- **1.4 Brand-risk defaults** — `timeout_action` defaults to `hold` everywhere;
  `getEditQueue()` surfaces pending EDIT replies instead of letting them vanish.

**Exit criteria met:** no stub platform can appear as a completed post; dispatch
retries and cannot duplicate; failures are logged and queryable; new businesses
default to approval-required; EDIT replies land somewhere actionable.

---

## Phase 2 — Front Door & Verified Core (Days 31–60)

**Goal:** a business can be onboarded, stay connected, and keep posting without
a developer touching the database. This is the single biggest usability gap —
the product cannot scale past hand-seeded pilot accounts without it.

### 2.1 Normalize platform connections
- Replace the 108×2 columns on `business` with a `platform_connection` table:
  `id, business_id, platform, account_id, account_name, access_token_ref,
  refresh_token_ref, scopes, status, expires_at, last_verified_at,
  last_posted_at, last_metrics_sync_at, failure_reason, created_at, updated_at`.
- Migrate existing `business.<platform>_id`/`<platform>_access_token` data into
  this table; update every adapter and `connectedPlatforms()` to read from it.
- This is also the adaptability fix: today adding a platform means adding two
  columns to `business`; after this, it's a row in a table.

### 2.2 Pick and verify the real core
- Select 5–10 platforms to take to `verified` status end-to-end this phase
  (candidates: GBP, Facebook, Instagram, LinkedIn, one of TikTok/YouTube
  Shorts, plus a listings/review platform where access is confirmed).
- For each: confirm OAuth flow, posting, insights fetch, token refresh, and
  failure visibility.
- Everything outside this verified set stays `sandbox`/`partner_gated`/`stub`
  and stays out of customer-facing reporting (Phase 1.2 already enforces this).

### 2.3 Self-serve onboarding & connection center
- Minimal UI/flow: business setup, OAuth connect per platform, approval
  channel setup (SMS/email), boost budget/threshold, brand-voice basics.
- Connection center per platform: connected / missing permissions / expired
  token / failed refresh / last successful post / last metrics sync / action
  required — the owner fixes their own problems instead of filing a ticket.
- Token expiry monitoring job flags `platform_connection` rows needing
  reconnection before they silently fail mid-week.

### 2.4 Per-business adaptability settings
- Settings live on `platform_connection`/`business` and actually change
  behavior, not just get stored: preferred platforms, posting cadence,
  approval policy, boost threshold/budget, brand-voice basics (banned
  words/claims, tone, approved services). The content engine and approval
  flow read these instead of using fixed constants.

### 2.5 Reporting accuracy
- Weekly report explicitly separates: posts published, posts pending, posts
  failed, platforms needing reconnection. No blended "activity" number.

### Phase 2 exit criteria
- A new business can be connected and posting without a developer touching
  the database.
- 5–10 platforms are genuinely `verified` (real OAuth, real posts, real
  metrics, real token refresh).
- Owners can see and fix their own connection problems.
- Per-business settings actually change system behavior.

---

## Phase 3 — ROI & Agent Operations (Days 61–90)

**Goal:** reports show business outcomes, and routine exceptions are handled
by agents instead of humans. This is the core moat per the assessment.

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
- Every score gap maps to a concrete recommended action — audit without
  action is a report, audit with agents is a product.

### 3.3 Agent-handled exceptions
- EDIT requests get an agent-drafted rewrite attached automatically, with the
  owner approving the rewrite via the existing SMS/email channel.
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

## Phase 4 — Adaptability at Scale: Agencies & Multi-Location (Days 91–120)

**Goal:** the highest-value customers (agencies, franchises, multi-location
brands) are usable without forking the data model per customer type.

### 4.1 Organization/location hierarchy
- Introduce `organization` above `business`, with `business` becoming
  `location` rows under an org. Existing single-location businesses become
  orgs of one — no special-casing.
- Brand-level templates/settings with per-location overrides (cadence,
  voice, approved offers) — adaptability means the override is a small diff,
  not a new code path.

### 4.2 Hierarchical approvals
- Approval policy becomes a chain, not a single owner: local manager →
  regional manager → brand compliance, each optional per org. SMS YES/NO
  still works for the single-location case; the chain only activates when
  configured.
- Pre-approved content libraries and an emergency content pause that applies
  at the org level.

### 4.3 Bulk operations & white-label
- Bulk publish/report across an org's locations.
- White-label mode (agency-branded approval messages/reports) — config-driven,
  not a fork.
- Consolidated billing and per-location benchmarking in reporting.

### Phase 4 exit criteria
- An agency can manage N locations under one org without per-location custom
  code.
- A franchise can require regional/brand approval without breaking the
  single-owner SMS flow for simpler accounts.

---

## Phase 5 — Durable Moats (Days 121+)

**Goal:** make the product harder to copy, not just more complete.

### 5.1 Partner access as a tracked risk, not a checklist item
- Per platform, track: does a usable API exist, does it support posting on
  behalf of unrelated businesses, is partner approval required/likely, what
  are the content/rate-limit rules. This list — not the adapter file count —
  is the real roadmap for platform expansion going forward.

### 5.2 Local performance data flywheel
- Once enough verified businesses are live, start aggregating (anonymized,
  per-vertical) which content themes, posting times, and platforms correlate
  with attributed leads/revenue from Phase 3 — feed this back into content
  generation defaults per industry/vertical.

### 5.3 Two-way messaging (only after the above is solid)
- Missed-call text-back, web chat, DM inbox — extends the "owner approves by
  text" interaction model the product is already built around, rather than
  adding a separate dashboard surface.

### 5.4 Partner-facing API
- Once Connect has enough verified scale, invert the integration relationship
  for the easiest platforms: they pull from Connect via a standard interface
  instead of Connect maintaining a bespoke adapter per platform.

---

## What This Program Explicitly Stops Doing

- No further "double/triple" platform-count expansions for their own sake.
- No new stub adapters added to the Tier-2 generic factory.
- No new service-signal modules until existing ones drive a recommendation,
  not just a stored row.
- No marketing or reporting language claiming "108 platforms" — copy should
  say "adapter framework covering 100+ destinations, with N platforms fully
  verified" until the verified count actually grows.
- No agency/multi-location modeling (Phase 4) until Phase 2's single-location
  onboarding is real — adaptability features built on top of a fake core just
  multiply the misrepresentation surface.
