# Connect — Phase 9 Scope Plan: Agentic Depth Without Faking Scale

Derived from `STANDALONE_PRODUCT_STRATEGY.md` §26 Months 7-12 and the
"Explicitly out of scope for Phase 8" list in `PHASE_8_SCOPE.md`. Depends on
Phase 8 shipping first (8.6's location rollup, 8.8's lead routing, 8.9's
action queue all get extended here, not replaced).

## Goal (per the doc)

Deepen the signals Connect already collects honestly — real-time lead
routing, location comparison, repeated review themes, vertical benchmarks —
without crossing into the items the doc explicitly says to hold the line on
(§16 "should not become a full CRM/PM tool", §22 "no flywheel or partner API
until data is real"). Nothing in this phase invents data Connect doesn't
actually have.

## Explicitly out of scope for Phase 9 (carried forward from Phase 8, still
gated)

Full agency console (multi-client console, **client billing**, bulk
approval UI), franchise corporate/location **permission enforcement**
(beyond comparison/ranking — actual role-based access control is an auth
project, not a data/automation one), CRM/PM system ownership (Connect routes
signals, never stores lead/deal state), full Tool-Calling Router migration
of the weekly batch, a performance flywheel, a partner-facing API. All
remain real, later items gated on more verified businesses/outcomes
existing first.

---

## 9.1 Real-Time Lead-Intent Owner Notification

**Doc reference:** §16 (CRM/PM bridge — "notifies the owner/team" is the one
sub-item of §16 that 8.8 didn't yet build).

**Why first:** lowest-risk, highest-leverage gap in 8.8 — a lead sitting
uninspected until the weekly digest is a real missed-business-opportunity,
not just a reporting gap.

**Current state:** `routeLeadIntentMessage` (8.8, `src/lib/messageIntent.ts`)
forwards a `lead_intent` customer message to `business.crm_webhook_url` if
configured, and the weekly digest reports a count. Nothing tells the owner
*today* that a lead came in.

**Scope:**
- `routeLeadIntentMessage` also sends the owner an immediate SMS/WhatsApp
  alert (reusing `sendApprovalSms`/`sendApprovalWhatsapp` and the business's
  `owner_preferred_channel`, exactly like every other owner-facing send in
  this codebase) — short, factual, includes the customer's message body and
  channel, never a fabricated urgency framing.
- This is additive to, not a replacement for, the existing webhook forward
  and the weekly digest count — a business with no CRM webhook configured
  still gets the real-time alert.
- Logged as an `agent_action` row (`tool: "notify_lead_intent"`, `source:
  "customer_message"`, `riskLevel: "low"`, `approvalRequired: false`) per
  8.9's "existing actions get logged" pattern, extended to this new action.

**Exit criteria:** a `lead_intent`-classified inbound message reaches the
owner's SMS/WhatsApp within the same request that classified it, with zero
change to businesses that have no preferred channel configured (silently
skipped, same as every other owner-send site in this codebase).

---

## 9.2 Multi-Location Comparison and Ranking

**Doc reference:** §10 ("location ranking" is named explicitly and is the
one sub-item of §10 that 8.6's rollup didn't build — 8.6 built the average,
not the comparison).

**Why second:** pure extension of 8.6's already-shipped
`buildOrgVisibilityRollup` — no new data collection, just a different view
of data already assembled.

**Current state:** `getOrgVisibilityRollup` (8.6,
`src/visibility-score/index.ts`) returns each location's score and an
org-wide average, unordered.

**Scope:**
- `rankOrgLocations(rollup: OrgVisibilityRollup)`: sorts scored locations by
  score descending, unscored locations last (never ranked ahead of a real
  score), and returns each location's rank alongside how far it sits above
  or below the org average — the same "gap from neutral" framing already
  used by `rankDrivers`/`renderWhatsNext` in `src/chat/scoreCard.ts`, not a
  new comparison model invented for this feature.
- Surfaced on the existing org weekly report (`buildOrgWeeklyReport`,
  `src/reporting/index.ts`) as a ranked list, and on
  `getOrgVisibilityRollup`'s callers via a new `getRankedOrgVisibilityRollup`
  wrapper — no new HTTP route needed since `handleOrgReportRoute` already
  exists for organizations.

**Exit criteria:** an org of one location ranks that location #1 by
construction (matching 8.6's existing "org of one behaves identically to a
single business view" guarantee); an org with unscored locations never
ranks them above a scored one.

---

## 9.3 Repeated Negative-Review Complaint Theme Detection

**Doc reference:** §20 ("repeated themes: create FAQ content, suggest
service-page content, suggest business process fixes, feed sentiment
score" — this phase builds only the detection/surfacing step, not the
downstream content generation, which is a distinct future item).

**Why third:** extends the existing negative-review escalation path
(`handleReachReview`, `src/reach-integration/index.ts`) with a signal that
only matters once enough reviews have accumulated — sequenced after 9.1/9.2
since it's the first item in this phase needing a DeepSeek classification
pass, same bounded-category pattern as 8.8's `classifyMessageIntent`.

**Current state:** each negative review gets an individually drafted reply
and owner escalation. No cross-review pattern detection exists — a business
with five "slow response time" reviews looks, to Connect, like five
unrelated one-off complaints.

**Scope:**
- `ComplaintTheme = "slow_response" | "price" | "quality" | "communication" | "scheduling" | "other"`,
  classified per negative review (`rating <= 3`) via the same
  graceful-degradation DeepSeek pattern as `classifyMessageIntent` — returns
  `null` on no text, no API key, or unmatched category, never fabricates a
  theme.
- `findRepeatedComplaintThemes(businessId, sinceISO, thresholdCount)`: counts
  classified themes across a business's reviews in the window and returns
  only themes meeting `thresholdCount` (default 3) — a single complaint is
  never reported as a "pattern."
- Surfaced as a line in the weekly report (`buildWeeklyReport`,
  `src/reporting/index.ts`) only when a theme clears the threshold — e.g.
  "3 reviews this month mentioned slow response time — worth a look."
  Silent otherwise; never invents a theme from too little data.

**Exit criteria:** a business with fewer than `thresholdCount` reviews
sharing a theme sees nothing new in its report; a business with a real
repeated theme sees it named with its actual count, not a vague "reviews
mention issues" hedge.

---

## 9.4 Vertical Benchmark Signal (Honest Early-Signal Framing)

**Doc reference:** §22 ("until then, call it what it is: early benchmark
signals, not a flywheel") and §26 Months 10-12 ("vertical benchmark
signals... only if data volume is real").

**Why last:** the doc's own gating language ("only if data volume is real")
means this has to be the most conservatively framed item in the phase — built
last so 9.1-9.3 are stable and this can be scoped defensively around the
doc's explicit honesty requirement.

**Current state:** `computeVisibilityScore`/`getLatestVisibilityScore`
(Phase 6.1) produce a single business's score with no peer context at all.

**Scope:**
- `getVerticalBenchmark(vertical, excludingBusinessId)`: computes the
  median score across other businesses sharing a vertical that have a
  computed score — median, not average, so a single outlier business can't
  drag a small sample.
- A **minimum sample size gate** (`MIN_BENCHMARK_SAMPLE = 5`): returns `null`
  (no benchmark) below the threshold rather than a misleadingly precise
  number from 1-2 peers — this is the doc's "call it what it is" instruction
  encoded directly into the function, not left to a caller's judgment.
- Where a benchmark exists, the operator snapshot
  (`src/lib/operatorSnapshot.ts`, 8.9) includes it labeled explicitly as
  `"early_benchmark_signal"` with the sample size attached
  (`{ medianScore, sampleSize }`) — never presented as a finished
  competitive intelligence product, and never shown at all below the
  sample-size gate.

**Exit criteria:** a vertical with fewer than 5 scored businesses never
shows a benchmark anywhere in the product; a vertical clearing the
threshold shows a real median with its honest sample size attached, not a
single hidden number.

---

## Build order

9.1 → 9.2 → 9.3 → 9.4 — ordered by ascending data-collection risk (a
real-time send first, a pure re-view of existing data second, a new but
single-business classification third, a cross-business aggregate gated on
sample size last).
