# Connect — Phase 8 Scope Plan: Performance & Vertical Depth (Days 61-90)

Derived from `STANDALONE_PRODUCT_STRATEGY.md` §26 Phase 3. Depends on
`PHASE_6_SCOPE.md` and `PHASE_7_SCOPE.md` shipping first — this phase moves
from "the work gets done" to "the work is proven to perform," per the doc's
own Phase 3 goal.

## Goal (per the doc)

Connect proves not only that work was done, but that visibility improved
and the right decisions were surfaced (doc §26 Phase 3 success metric).

## Addendum: the agent-operable thesis (not a new phase)

A second strategy review argued Connect's biggest standalone advantage may
not be "AI-generated posts" but **agent-native infrastructure**: truthful
state (`verified`/`sandbox`/`stub` tagging, real vs. synthetic metrics)
that a Claude/OpenClaw-style operator agent can safely read and act on,
with the owner staying in SMS/chat rather than a dashboard. This is not a
separate phase — it is exactly what 8.9 (action queue) and 8.10 (tool
router) already build toward, so their scope below is expanded to cover
it directly rather than spawning new numbering. Two items absorb the bulk
of the addendum: a read-only **operator snapshot** endpoint (folded into
8.9) and an explicit **tool surface + dry-run/failure-diagnosis contract**
(folded into 8.10). The "owner does not need a dashboard; the agent is the
dashboard" framing is consistent with, not a departure from, the existing
zero-dashboard constraint (doc §5/§24) — it explains *why* that constraint
is strategically right, it doesn't ask for a dashboard to be built for a
different audience.

---

## 8.1 A/B Creative Testing Before Boost

**Doc reference:** §17, §26 Phase 3 item 1.

**Why first:** the doc calls this "one of the highest-leverage standalone
upgrades," and the boost policy engine (8.2) is more defensible once boosts
are backed by a tested winner rather than a single untested variant.

**Current state:** `src/content-engine/generate.ts` generates a single
caption/creative per content item; `src/approval/boost.ts` proposes a boost
on that single post's performance.

**Scope:**
- Generate two caption variants (and, where the platform/budget allows, two
  creative variants) for posts flagged as boost candidates — not for every
  post, to avoid doubling generation cost across the whole calendar.
- Where organic split-testing is feasible (e.g. staggered posting),
  measure both variants' engagement before proposing a boost; where it
  isn't, fall back to today's single-variant flow rather than inventing a
  synthetic comparison.
- Boost proposal copy includes the comparison per the doc's example: "We
  tested two versions. Version B got 42% more engagement. Want to boost it
  for $25?" — only shown when a real comparison exists; never fabricated
  when only one variant ran.

**Exit criteria:** at least one platform's boost proposals can cite a real
A/B comparison; posts that didn't get a real test never claim one in their
proposal copy.

---

## 8.2 Boost Policy Engine

**Doc reference:** §18, §26 Phase 3 item 2.

**Why second:** extends the existing hard 5x clamp (`clampBudget` in
`src/approval/boost.ts`) with graded autonomy — needs 8.1 in place first so
auto-boost thresholds have a meaningful performance signal to key off of.

**Current state:** every boost requires an explicit owner SMS/WhatsApp
approval; `clampBudget` only enforces an upper bound on a requested amount.

**Scope:**
- Per-business policy fields on `BusinessProfile` (Phase 6.2): max weekly
  spend, max daily spend, max boost per post, auto-boost threshold, manual
  approval threshold, allowed platforms, stop-loss condition, budget reset
  schedule — the doc's exact field list in §18.
- `handleBoostReply`'s flow gains an auto-boost path: if a post beats the
  business's configured performance threshold AND the proposed amount is
  under the business's `auto-boost threshold` AND weekly spend is under the
  weekly cap, launch without an approval round-trip; otherwise behave
  exactly as today (approval required).
- The existing 5x hard safety cap (`clampBudget`) remains the absolute
  ceiling regardless of policy configuration — policy can be stricter than
  the hard cap, never looser.
- Auto-boost and boost-eligibility threshold checks only consider a post on
  a `verified`-tier platform (`src/lib/platformStatus.ts`) — a stub/sandbox
  platform's synthetic metrics can never trigger or justify a boost, agent-
  proposed or owner-approved alike, per the second strategy review's point
  that boost logic must not act on metrics that aren't real.

**Exit criteria:** a business with no policy configured behaves identically
to today (always asks); a business with auto-boost configured gets
spend launched within its own stated limits, never exceeding the existing
hard cap.

---

## 8.3 Vertical-Specific Score Weights (Restaurant + Wellness)

**Doc reference:** §9.2, §9.3, §26 Phase 3 item 3.

**Why third:** Phase 6.3 shipped only the home-services weight table by the
doc's own sequencing (§9.1, "probably the best first vertical"); this item
is explicitly the deferred follow-up — tuning restaurant and wellness
weights now that the `vertical` field and weight-table shape already exist.

**Scope:**
- Fill in the `restaurant` and `wellness` entries in
  `src/visibility-score/weights.ts` (stubbed in Phase 6.3) using the doc's
  §4/§9.2/§9.3 weight guidance (reviews/sentiment and GBP/Yelp/OpenTable
  high for restaurants; Instagram/TikTok and trust signals high for
  wellness).
- Vertical-specific audit report copy (Phase 6.3 shipped this for home
  services only) extended to these two verticals.

**Exit criteria:** all three named verticals (home services, restaurant,
wellness) produce genuinely different score weightings and report copy;
`general` remains the unweighted fallback.

---

## 8.4 Vertical-Specific Platform Priority Map

**Doc reference:** §12, §26 Phase 3 item 4.

**Why fourth:** directly follows 8.3 — once a business has a vertical, the
doc says platform expansion work (moving platforms out of `stub`) should be
prioritized by that vertical's named platform list, not engineering
convenience.

**Scope:**
- A static map (`src/lib/verticalPlatformPriority.ts`): vertical → ordered
  platform list, taken directly from doc §12 (home services: GBP Local
  Posts, Nextdoor, Angi, Thumbtack, Yelp, Facebook, Instagram, YouTube
  Shorts, Bing Places; restaurant: GBP, Yelp, OpenTable, TripAdvisor,
  Instagram, TikTok, Facebook; wellness: Instagram, TikTok, GBP, Yelp,
  Facebook, YouTube Shorts).
- This is a **planning artifact**, not new adapter code — it informs which
  `stub`/`sandbox` platforms get prioritized for verification work, doc
  §12's "do not chase logos."

**Exit criteria:** any future platform-verification work can point to this
map to justify why a given platform was prioritized for a given vertical,
instead of an ad hoc choice.

---

## 8.5 Paid Boost Performance Report

**Doc reference:** §26 Phase 3 item 5. Builds on existing Phase 3 (original
program) outcome-attribution work (UTM tagging, call/form tracking).

**Scope:**
- Extend the weekly digest (Phase 6.5) with a boost-specific section:
  amount spent, attributed engagement/clicks (via existing UTM tagging),
  and — only where a real attribution path exists (call tracking, form
  tracking, CRM/booking event) — attributed leads/revenue. Sections with no
  attribution path are omitted, not estimated.

**Exit criteria:** a business with a wired attribution path sees real
lead/revenue numbers tied to a specific boost; a business without one sees
spend/engagement only, never a fabricated lead estimate.

---

## 8.6 Multi-Location Data Model

**Doc reference:** §10, §26 Phase 3 item 6.

**Why this far down:** the doc places this in Phase 3, after the
single-business owner experience (Phase 6/7) is real — same reasoning the
original Phase 4 program already applied to Phase 2. This item is the data
model only; the full agency console and franchise permission hierarchy
(doc §10, §11) are Phase 9+ candidates, not in scope here.

**Scope:**
- Introduce `organization` above `business` (as already planned in the
  original program's Phase 4.1) with `business` becoming a `location` row
  under an org — existing single-location businesses become orgs of one,
  no special-casing.
- Location-level visibility scores roll up to an org-level view (read path
  only this phase) — brand templates, corporate/local permission
  enforcement, and bulk operations remain out of scope until a real
  multi-location customer exists to validate against.

**Exit criteria:** an org with N locations can see each location's score
and an aggregate, with zero behavior change for existing single-location
orgs.

---

## 8.7 Agency White-Label Report v1

**Doc reference:** §11, §26 Phase 3 item 7.

**Why here:** the doc's cheapest growth lever, but deliberately scoped down
to *report* white-labeling only — full agency console (multi-client
console, client billing, bulk approval) is explicitly a later doc item
(§11's fuller list), not this phase's.

**Scope:**
- The weekly email digest (Phase 6.5) and chat score card (Phase 7.2)
  already resolve `orgDisplayName`/white-label name — extend this to also
  swap the SMS/WhatsApp sender identity per org, so an agency's clients see
  the agency's brand end-to-end, not just in the email subject line.

**Exit criteria:** an agency-managed business's entire approval/report
surface (SMS sender name, email branding, chat replies) shows the agency's
brand, not "MightyMax," with zero config needed for non-agency businesses.

---

## 8.8 Missed-Call and Customer-Message Lead Routing

**Doc reference:** §16 (CRM/PM bridge, scoped down), §26 Phase 3 item 8.

**Why scoped down:** the doc explicitly warns Connect "should not become a
full CRM/PM tool" (§16) — this phase implements only the *detection and
routing* half of §16, not CRM/PM creation itself, since no CRM/PM system is
integrated yet and inventing one would violate the truth-telling principle
this whole program is built on.

**Current state:** `src/lib/missedCallTextback.ts` and
`src/lib/customerMessaging.ts` already detect missed calls and log inbound
messages.

**Scope:**
- Classify inbound customer messages/missed-call follow-ups into a fixed
  set of intents (`lead_intent`, `question`, `complaint`, `other`) using
  the same kind of bounded classification as Phase 7.3's edit-reply
  categories — not open-ended.
- `lead_intent` messages get flagged in the weekly digest (8.5) and, if the
  owner's profile has an external CRM webhook URL configured (new optional
  `BusinessProfile` field), POSTed there — Connect routes the signal; it
  does not store or manage the lead itself.

**Exit criteria:** a lead-intent message is visible to the owner within the
existing reporting/approval surfaces, and optionally forwarded to an
external system if configured; Connect holds no CRM state of its own.

---

## 8.9 Agent Action Queue v1

**Doc reference:** §15 (architecture), §26 Phase 3 item 9.

**Why ninth:** prerequisite for 8.10's router — the doc's future model
(`event/schedule → intent router → tools → action queue → policy check →
execute or approve → log → report`) needs the queue to exist before a
router can write to it.

**Scope:**
- An `agent_action` table matching the doc's exact record shape: source,
  intent, tool, input, output, status, risk level, approval required, owner
  response, platform result, error, retry count, audit log.
- Existing actions (content generation, posting, boost proposals) get
  logged into this table as a **parallel audit trail** this phase — the
  existing weekly-batch code path is not rewritten to depend on the queue
  yet, avoiding the doc's explicit warning ("the weekly cron loop is good,
  do not destroy it").
- **Operator snapshot read endpoint** (`GET
  /businesses/:id/operator-snapshot`), per the second strategy review's
  point that an agent needs one call to understand a business's full
  current state rather than stitching together five endpoints itself.
  Assembled entirely from data this phase and Phase 6/7 already compute —
  no new collection: `BusinessProfile` + vertical, the 6.1 score breakdown
  (score, trend, drivers, nextBestFix, dataConfidence), connection health
  (6.4's `getConnectionSummary`, including `missing_permissions`/
  `failed_refresh`), pending approvals, recent `agent_action` rows,
  boost candidates (8.1/8.2), and unresolved reviews. Each driver/action in
  the response carries the doc's honesty tags (`risk`, `approval_required`,
  `dataConfidence`) so an agent never treats a stub/sandbox platform's
  numbers as real — the existing truth-tagging becomes the agent safety
  layer, not a second one invented for agents specifically.

**Exit criteria:** every action the existing system already takes is
visible as a row in `agent_action` with full context, without changing how
or when those actions actually execute; the operator snapshot endpoint
gives a one-call summary of a business that an agent (or a human) could
act on without querying the database directly.

---

## 8.10 Tool-Calling Intent Router — Design + First Implementation

**Doc reference:** §15, §25 (build order rationale), §26 Phase 3 item 10.

**Why last:** the doc is explicit and repeated (§15, §25) that this is a
platform architecture move that follows once the core owner experience
(Phase 6/7) is strong — this is the single largest-risk item in the whole
90-day plan and is scoped as design + first implementation only, not a full
migration.

**Scope:**
- Register the doc's example tools (§15) as discrete callable functions
  with typed input/output, wrapping existing logic
  (`generate_content`→`content-engine/generate.ts`,
  `post_to_platform`→`distribution/index.ts`, `propose_boost`/`launch_boost`
  →`approval/boost.ts`, `run_visibility_audit`→the audit modules) — wrapping,
  not rewriting, so existing tested behavior is preserved.
- One real trigger path routed through the router end-to-end as a proof of
  concept (e.g. the 7.2 chat-intent classifier's `show_score`/`whats_next`
  becomes router-dispatched instead of a bespoke branch) — not the full
  weekly batch, which stays on its existing direct code path per 8.9's
  scope note.
- Policy-check step reuses 8.2's boost policy engine as its first real
  policy gate, rather than inventing a separate policy model.
- Per the second strategy review's tool taxonomy, the registered tools this
  phase are read/planning tools layered on 8.9's snapshot
  (`get_operator_snapshot`, `get_visibility_score`, `get_connection_health`,
  `get_pending_approvals`) plus the handful of action tools that already
  have a real, tested implementation to wrap (`queue_content`,
  `propose_boost`, `run_visibility_audit`) — tools with no real backing
  implementation yet (e.g. `create_crm_lead` beyond 8.8's webhook POST,
  `create_pm_task`) are explicitly not registered this phase rather than
  exposed as a tool that silently no-ops.
- Every tool call writes its `agent_action` row (8.9) with a **dry-run
  mode**: a tool can be invoked with `dryRun: true` to return what it would
  do (target platform, cost, risk, approval requirement) without executing,
  reusing the same input validation/policy-check path as a real call so the
  preview can't drift from actual behavior.
- Tool errors return the doc's structured-diagnosis shape (failed step,
  underlying reason, required owner action) instead of a bare exception
  string — wrapping existing error paths (e.g. a Meta token error already
  carries a reason in `DistributionFailure`/`recordFailure`'s classification
  from 6.4) rather than inventing new diagnostic text per tool.

**Exit criteria for the addendum:** an agent (or a test harness standing in
for one) can call `get_operator_snapshot`, dry-run a `propose_boost` call,
and see the resulting risk/approval/cost preview match what a real
`propose_boost` call would have done — without that agent ever needing
direct database access.

**Exit criteria:** at least one real owner-facing flow is dispatched
through the router/tool-registry/action-queue path instead of a direct
function call, with the weekly batch loop completely unaffected and still
running on its proven direct path.

---

## Explicitly out of scope for Phase 8

Full agency console (multi-client console, client billing, bulk approval —
beyond report white-labeling), franchise permission hierarchy and brand
governance (beyond the location data model), CRM/PM system ownership,
full Tool-Calling Router migration of the weekly batch, performance
flywheel, partner-facing API. All are real, later items (doc §10/§11 full
scope, §26 Months 7-12) gated on Phase 8 proving out at smaller scale first.

## Build order

8.1 → 8.2 → 8.3 → 8.4 → 8.5, then 8.6/8.7/8.8 in any order (independent of
each other and of 8.1-8.5), then 8.9 → 8.10 last, since the action queue and
router are the highest-risk items and benefit most from everything else
being stable first.
