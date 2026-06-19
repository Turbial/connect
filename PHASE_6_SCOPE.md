# Connect — Phase 6 Scope Plan: Standalone Product

Derived from the "Standalone Product Strategy: The Truthful Autonomous Marketing
Operator" positioning doc. This translates that strategy into an actionable,
codebase-grounded scope — what gets built, against which files, in what order.

## Operating Principle (carried forward, unchanged)

Phases 1-5 proved the core loop and refused to fake it. Phase 6 does not relax
that principle — it productizes it. Every item below either (a) makes the
truth-telling layer visible to a buyer, or (b) removes a step that currently
requires a developer or a dashboard. Nothing here adds platform count,
flywheel logic, or partner APIs ahead of real scale — those stay deferred per
Phase 5's existing exit criteria.

## Why Phase 6 exists

Phases 1-5 built a system that works. The standalone-product doc identifies
correctly that **what's missing isn't a feature, it's a front door**: a
business has no way to receive a score, understand it, onboard, and start
receiving the weekly loop without a developer seeding rows by hand. Phase 6
closes that gap, in the order the doc itself recommends (onboarding + score
audit + rich approvals, before any agent/router architecture work).

---

## 6.1 Visibility Score — Explainability (foundation for everything else)

**Why first:** every other Phase 6 item (audit funnel, vertical weighting,
weekly digest, chat-card scores) depends on the score being explainable, not
just a number. This is also the smallest, most self-contained piece — pure
logic, no new external integration.

**Current state:** `src/visibility-score/index.ts` already computes the 0-100
score from real signals (SEO, duplicates, rank, sentiment, competitors,
listing sync, ads readiness) and is the most heavily unit-tested module in the
codebase (`index.test.ts`, 8 tests on the pure scoring functions).

**Gap:** it returns a single number. The doc requires, per report: current
score, previous score, trend, top positive/negative drivers, next-best-fix,
confidence level, and which inputs are verified vs. missing.

**Scope:**
- Extend the score computation to return a structured breakdown object
  (`ScoreBreakdown`: `score`, `previousScore`, `trend`, `drivers: { signal,
  contribution, direction }[]`, `nextBestFix`, `dataConfidence`).
- Persist the previous score (or look it up from history) so trend is real,
  not synthetic.
- `nextBestFix` = the single negative driver with the largest score impact
  that has a known remediation (duplicate listing flagged → "resolve N
  duplicate listings"; low rank → "improve local rank tracking signal"; etc.)
  — a static lookup table keyed by signal name, not a generated/guessed claim.
- `dataConfidence`: explicit per-signal flag (`verified` / `stale` / `missing`)
  based on whether each underlying audit module has reported recently for
  this business — reuses the same honesty pattern as `platformStatus.ts`.
- Surface the breakdown via the existing `GET /businesses/:id/visibility-score`
  route (`src/index.ts`) instead of the route's current shape.

**Exit criteria:** the score endpoint returns a breakdown a non-technical
owner could read and understand without explanation; no field is fabricated
when underlying data is missing — it's labeled missing instead.

---

## 6.2 Vertical Score Weighting

**Why second:** directly extends 6.1; the doc's verticalization case (home
services / restaurant / wellness) is sold on the same score, just re-weighted.
Doing this immediately after 6.1 means the breakdown structure is designed
with weighting in mind from the start, instead of retrofitted.

**Scope:**
- Add a `vertical` field to `Business` (e.g. `"home_services" | "restaurant" |
  "wellness" | "general"`), defaulting to `"general"` for existing rows — no
  forced re-categorization.
- Add a weight table per vertical (`src/visibility-score/weights.ts`):
  signal → weight, with `"general"` as today's implicit equal weighting.
- `computeVisibilityScore` takes the business's vertical and applies its
  weight table instead of a hardcoded uniform weighting.
- Only three vertical weight profiles ship in this phase (home services,
  restaurant, wellness) — matching the doc's chosen beachhead verticals, not
  a speculative full taxonomy.

**Exit criteria:** the same signals produce different scores/driver rankings
for a `home_services` business vs. a `restaurant` business with identical
underlying data, and `general` is unchanged from current behavior (no
regression for existing pilot businesses).

---

## 6.3 Onboarding Data Model

**Why third:** the doc calls this "the hidden critical path." It's also a
prerequisite for 6.2 (need a `vertical` field, brand-voice, competitor list,
approval policy — currently these either don't exist or are scattered/inferred)
and for any audit-funnel acquisition flow.

**Current state:** `src/lib/orgSettings.ts` resolves a narrow set of settings
(boost budget, white-label name) business → org → constant. No structured
intake exists; businesses are seeded directly into the DB.

**Scope:**
- Define the onboarding field set as a typed `BusinessProfile` shape: vertical,
  service area/address, owner phone, owner preferred channel (sms/email/
  whatsapp), brand tone, banned words/claims, competitor list, approval
  policy (auto/manual, per-channel), boost policy basics (ceiling, cadence).
  This is schema + types only in this phase — not a UI.
- Extend `resolveBusinessSetting` usage to read from this richer profile
  instead of just `boost_budget_cents`/`white_label_name`.
- A single intake function (`createBusinessProfile`) that validates required
  fields and defaults the rest — this is the seam a future signup flow or
  agency console calls into, so it's built once and reused rather than
  duplicated per future UI.

**Exit criteria:** a new business can be fully described by one function call
with required fields validated; existing settings resolution (boost budget,
white-label name) keeps working unchanged on top of the richer profile.

---

## 6.4 WhatsApp/Messenger Rich Approval Cards

**Why fourth, not first:** the doc itself ranks "onboarding + score audit"
above "Messenger cards" in its own build order — rich approval cards are a UX
upgrade on a decision flow that needs to exist and be correct first (which it
already does, via SMS). This item upgrades the channel, not the logic.

**Current state:** `src/approval/` (boost.ts, sms.ts) parses plain-text
SMS replies (YES/NO/EDIT, optional budget) with word-boundary-anchored
matching — this logic is correct and tested (`boost.test.ts`, `sms.test.ts`).

**Scope:**
- New adapter `src/approval/whatsapp.ts` (or extend `src/distribution/`
  pattern) sending WhatsApp Business API template messages with: media
  preview, caption, and reply-button options (Approve & Post / Regenerate /
  Edit / Hold for content; Boost $X / Decline / Show me why for boosts).
- Button-click webhook payloads map to the **same** `parseBoostReply`/
  `parseReply` decision types already used for SMS — no parallel decision
  logic, channel is just a different transport into the same parser/handler.
- `getLatestInboundChannel` (`src/lib/customerMessaging.ts`) already tracks
  which channel a business last used; extend reply-sending to honor the
  owner's preferred channel from the 6.3 profile instead of defaulting to SMS.

**Exit criteria:** a boost/edit approval round-trip works end-to-end over
WhatsApp using the existing parsing/decision code, with SMS continuing to
work unchanged as the fallback for businesses without WhatsApp set up.

---

## Explicitly out of scope for Phase 6

Per the standalone-product doc's own sequencing and Phase 5's existing
deferral logic:
- Tool-Calling Intent Router / Agent Action Queue — doc explicitly places
  this after the core owner experience, not before.
- A/B creative testing before boost — Phase 7 candidate, depends on 6.1-6.4
  being live first.
- Boost policy engine (auto-boost thresholds, stop-loss) — extends the
  existing hard 5x clamp; deferred until 6.3's profile model is in place to
  hang per-business policy on.
- Franchise/multi-location hierarchy, agency white-label console — real, but
  premature ahead of a working single-business onboarding path (same
  reasoning Phase 4 already applied to Phase 2).
- Performance flywheel, partner-facing API — unchanged from Phase 5: blocked
  on real verified-business scale that doesn't exist yet.

## Build order

6.1 → 6.2 → 6.3 → 6.4, each gated on the previous one's exit criteria, each
shippable independently (no item blocks deploying the others if reprioritized).
