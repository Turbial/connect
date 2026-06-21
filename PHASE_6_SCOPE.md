# Connect — Phase 6 Scope Plan: Standalone Trust & Onboarding (Days 1-30)

Derived from `STANDALONE_PRODUCT_STRATEGY.md` §26 Phase 1. This translates
that strategy into an actionable, codebase-grounded scope — what gets built,
against which files, in what order. Phase 7 and Phase 8 cover the strategy
doc's Phase 2 and Phase 3 respectively.

## Operating Principle (carried forward, unchanged)

Phases 1-5 proved the core loop and refused to fake it. Phase 6 does not
relax that principle — it productizes it. Every item below either (a) makes
the truth-telling layer visible to a buyer, or (b) removes a step that
currently requires a developer or a dashboard. Nothing here adds platform
count, flywheel logic, or partner APIs ahead of real scale — those stay
deferred per Phase 5's existing exit criteria and §22 of the strategy doc.

## Why Phase 6 exists

Phases 1-5 built a system that works. The strategy doc identifies correctly
that **what's missing isn't a feature, it's a front door**: a business has
no way to receive a score, understand it, onboard, and start receiving the
weekly loop without a developer seeding rows by hand. Phase 6 closes that
gap — "make Connect sellable and understandable as a standalone product"
(doc §26, Phase 1 goal).

---

## 6.1 Visibility Score — Explainability (foundation for everything else)

**Doc reference:** §3 ("must be explainable"), §4 (formula), §26 Phase 1
item 1 ("Free/paid Visibility Score audit flow").

**Why first:** every other Phase 6/7 item (audit funnel, vertical weighting,
weekly digest, chat-card scores) depends on the score being explainable, not
just a number. Smallest, most self-contained — pure logic, no new external
integration.

**Current state:** `src/visibility-score/index.ts` computes the 0-100 score
from real signals (SEO, duplicates, rank, sentiment, competitors, listing
sync, ads readiness), heavily unit-tested (`index.test.ts`, 8 tests).

**Gap:** returns a single number. Doc requires: current score, previous
score, trend, top positive/negative drivers, next-best-fix, confidence
level, which data is verified vs. missing.

**Scope:**
- Structured `ScoreBreakdown` object: `score`, `previousScore`, `trend`,
  `drivers: { signal, contribution, direction }[]`, `nextBestFix`,
  `dataConfidence`.
- Persist the previous score (or look it up from history) so trend is real,
  not synthetic.
- `nextBestFix` = the single negative driver with the largest score impact
  that has a known remediation — a static lookup table keyed by signal name
  (duplicate listing flagged → "resolve N duplicate listings"; low rank →
  "improve local rank tracking signal"), not a generated/guessed claim.
- `dataConfidence`: explicit per-signal flag (`verified`/`stale`/`missing`)
  based on whether each underlying audit module has reported recently for
  this business — reuses the honesty pattern from `platformStatus.ts`.
- Surface the breakdown via the existing `GET /businesses/:id/visibility-score`
  route (`src/index.ts`) instead of the route's current shape.

**Exit criteria:** the score endpoint returns a breakdown a non-technical
owner could read and understand without explanation; no field is fabricated
when underlying data is missing — it's labeled missing instead.

---

## 6.2 Business Profile / Brand Kit (Onboarding Data Model)

**Doc reference:** §13 (onboarding field list), §26 Phase 1 item 3
("Business profile/brand kit").

**Why second:** prerequisite for vertical-specific audits (6.3), connection
onboarding (6.4), and every later personalization item in Phase 7.

**Current state:** `src/lib/orgSettings.ts` resolves a narrow set of
settings (boost budget, white-label name) business → org → constant. No
structured intake exists; businesses are seeded directly into the DB.

**Scope:**
- Typed `BusinessProfile` shape covering the doc's onboarding field list:
  vertical/industry, address/service area, phone, website, owner mobile,
  owner preferred channel (sms/email/whatsapp), services/offers, brand tone,
  banned words/claims, logo/photo refs, competitor list, target locations,
  posting cadence, compliance restrictions. Schema + types only this phase —
  not a UI.
- Extend `resolveBusinessSetting` usage to read from this richer profile
  instead of just `boost_budget_cents`/`white_label_name`.
- A single validating intake function (`createBusinessProfile`) — the seam a
  future signup flow or agency console calls into, built once and reused
  rather than duplicated per future UI.

**Exit criteria:** a new business can be fully described by one function
call with required fields validated; existing settings resolution (boost
budget, white-label name) keeps working unchanged on top of the richer
profile.

---

## 6.3 Vertical Score Weighting + Vertical-Specific Audit Report

**Doc reference:** §8 (verticalization), §9.1-9.3 (home services /
restaurant / wellness weight tables), §26 Phase 1 item 2
("vertical-specific audit report for one beachhead vertical").

**Why third:** depends on 6.1 (breakdown structure) and 6.2 (`vertical`
field living on the profile). Doc explicitly recommends shipping **one**
beachhead vertical first (§9.1 names home services as the best first
vertical), not all three at once.

**Scope:**
- Add `vertical` to `BusinessProfile` (`"home_services" | "restaurant" |
  "wellness" | "general"`), defaulting to `"general"` — no forced
  re-categorization of existing rows.
- Weight table per vertical (`src/visibility-score/weights.ts`): signal →
  weight, with `"general"` as today's implicit equal weighting. Ship
  **home services** weights first per the doc's own recommendation;
  restaurant/wellness tables are stubbed with the same shape but not tuned
  yet (explicit per-vertical correctness review happens in Phase 7 §9.2/9.3
  follow-up, not blocking this phase).
- `computeVisibilityScore` takes the business's vertical and applies its
  weight table instead of a hardcoded uniform weighting.
- Audit report copy (the text presented alongside the score) branches on
  vertical to use the doc's per-vertical content-angle/metric language for
  home services; other verticals fall back to generic copy until tuned.

**Exit criteria:** the same signals produce different scores/driver
rankings for a `home_services` business vs. `general`; `general` is
unchanged from current behavior (no regression for existing pilot
businesses).

---

## 6.4 Connection Onboarding & Health States

**Doc reference:** §26 Phase 1 items 4-6 ("Owner phone + Messenger/WhatsApp
verification," "Platform connection onboarding," "Connection health
states"), §13 (compliance/platform fields).

**Why fourth:** requires 6.2's profile (owner preferred channel) to know
which channel to verify, and feeds the truth-labeled platform status view
(6.6).

**Current state:** `src/jobs/checkConnections.ts` / `getConnectionSummary`
already reports which platforms are connected for a business — this is
read-only/internal today, not an onboarding flow.

**Scope:**
- Owner verification step: send a one-time code/confirmation via the
  owner's preferred channel (SMS today; WhatsApp lands in Phase 7) and
  record `owner_verified_at` on the profile before the weekly loop is
  allowed to run for that business.
- Per-platform connection states surfaced through `getConnectionSummary`
  beyond today's connected/not-connected: `missing_permissions`,
  `expired_token`, `failed_refresh`, alongside existing `last_posted_at`/
  `last_metrics_sync_at` — these states already exist conceptually in
  Phase 1/2 reliability work; this item exposes them as a queryable
  onboarding surface instead of only internal logs.
- Reuse the existing token-expiry monitoring job pattern (Phase 2.3) rather
  than building a second one.

**Exit criteria:** a business's connection state (and any action required)
is queryable end-to-end without reading logs or the database directly.

---

## 6.5 Weekly Email Digest v1

**Doc reference:** §21 (digest contents), §26 Phase 1 item 7.

**Why fifth:** the doc separates SMS/Messenger ("for decisions") from email
("for proof") — this is the proof surface, and it's additive on top of data
6.1-6.4 already produce; no new signal collection needed.

**Current state:** `src/reporting/index.ts` (`buildOrgWeeklyReport`)
already assembles a weekly report object; no email delivery exists.

**Scope:**
- Email rendering of the existing report object plus the new 6.1 score
  breakdown: score + change, top 3 completed actions, content posted, best
  performing post, boost recommendation/result, reviews summary,
  listing/rank/SEO issues, competitor movement, missed-call recovery, next
  best fix, connection health issues.
- White-label support reuses `orgDisplayName` (already resolves white-label
  name) — no new resolution logic, just applied to email branding.
- Delivery via a transactional email provider, gated behind the same
  `withRetry` reliability primitive already used for platform dispatch
  (Phase 1.3) rather than a bespoke retry path.

**Exit criteria:** an org's weekly report reaches the owner's inbox with no
manual step, using real data only — any section with no current data is
omitted or labeled missing, not fabricated.

---

## 6.6 Truth-Labeled Platform Status View

**Doc reference:** §7 (platform status language), §26 Phase 1 item 9.

**Why sixth:** purely exposes existing data (`platformStatus.ts`,
`partnerAccessRisk.ts`) through honest copy — no new logic, lowest risk,
can ship any time after 6.1-6.5 land alongside them.

**Current state:** `src/lib/platformStatus.ts` and
`src/lib/partnerAccessRisk.ts` already compute this; `GET
/platforms/partner-access-risk` already exposes the risk register over
HTTP.

**Scope:**
- A single read endpoint/response shape that renders the doc's exact
  framing: count of `verified` (full-loop) platforms, count of
  organic-only platforms with a real adapter, and an explicit list of
  `sandbox`/`partner_gated`/`stub` platforms with the reason each is
  gated — sourced directly from existing tagging, never a hardcoded "108
  platforms" claim.

**Exit criteria:** any platform-count claim the product makes anywhere
(audit report, email digest, marketing copy) is generated from this
endpoint's data, not authored separately — so the claim can't drift from
reality.

---

## 6.7 Pricing/Package Setup

**Doc reference:** §23 (package tiers), §26 Phase 1 item 10.

**Why last:** packaging needs the feature surface (6.1-6.6) to exist before
tiers can be drawn around it; doc lists this last in Phase 1 for the same
reason.

**Scope:**
- Define `Starter Audit` and `Local Operator` (the two packages whose
  features are fully covered by Phase 6 + existing Phases 1-5) as concrete
  feature-flag sets on `BusinessProfile`/org — not billing integration
  itself, just the entitlement model the rest of the system can check
  against (e.g. "does this org's package include weekly boost proposals").
  `Growth Operator`/`Vertical Pro`/`Agency`/`Franchise` tiers are named
  placeholders only, since their features ship in Phase 7/8.

**Exit criteria:** the system can answer "does this business's package
include X" for every Phase 6 feature without a developer hardcoding
per-business exceptions.

---

## Explicitly out of scope for Phase 6

Everything the strategy doc places in its own Phase 2/Phase 3 (see
`PHASE_7_SCOPE.md` / `PHASE_8_SCOPE.md`): Messenger/WhatsApp rich approval
cards, creative memory, A/B testing, boost policy engine, multi-location,
agency console, Tool-Calling Intent Router/Agent Action Queue. Also
unchanged from Phase 5: performance flywheel, partner-facing API — blocked
on real verified-business scale that doesn't exist yet (doc §22).

## Build order

6.1 → 6.2 → 6.3 → 6.4 → 6.5 → 6.6 → 6.7, each gated on the previous one's
exit criteria. 6.5-6.7 are independently shippable/reorderable relative to
each other once 6.1-6.4 land; 6.1-6.4 have real dependencies and should not
be reordered.
