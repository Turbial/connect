# Connect — Phase 7 Scope Plan: Zero-Dashboard Operator Experience (Days 31-60)

Derived from `STANDALONE_PRODUCT_STRATEGY.md` §26 Phase 2. Depends on
`PHASE_6_SCOPE.md` shipping first — this phase upgrades the channel and
interaction richness on top of a profile/score/connection foundation that
must already exist.

## Goal (per the doc)

Make the owner experience feel like magic, not setup work: owner can run
approvals, edits, boosts, and score checks entirely from chat/email without
logging into a dashboard (doc §26 Phase 2 success metric). This phase does
not introduce a dashboard at any point — see doc §5 and §24.

---

## 7.1 WhatsApp/Messenger Rich Approval Cards

**Doc reference:** §6 (Messenger/WhatsApp upgrade, example cards), §26
Phase 2 items 1-3.

**Why first:** every other Phase 7 item either rides on this channel
(score-in-chat, regenerate/edit buttons) or is independent of it — this is
the highest-leverage single item.

**Current state:** `src/approval/` (`boost.ts`, `sms.ts`) parses plain-text
SMS replies (YES/NO/EDIT, optional budget) with word-boundary-anchored
matching — correct and tested (`boost.test.ts`, `sms.test.ts`).

**Scope:**
- New adapter `src/approval/whatsapp.ts` sending WhatsApp Business API
  template messages with media preview, caption, and button options:
  Approve & Post / Regenerate Image / Edit Caption / Hold (content cards);
  Boost $X / Decline / Show me why (boost cards) — matching the doc's exact
  example cards in §6.
- Button-click webhook payloads map into the **same** `parseBoostReply`/
  `parseReply` decision types already used for SMS — no parallel decision
  logic; channel is just a different transport into the same
  parser/handler, per the doc's "no fake architecture duplication"
  philosophy.
- `getLatestInboundChannel` (`src/lib/customerMessaging.ts`) already tracks
  last-used channel; extend reply-sending to honor the owner's preferred
  channel from the Phase 6.2 `BusinessProfile` instead of defaulting to SMS.

**Exit criteria:** a boost/edit approval round-trip works end-to-end over
WhatsApp using the existing parsing/decision code; SMS continues to work
unchanged as the fallback for businesses without WhatsApp set up.

---

## 7.2 Visibility Score Card in Chat ("Zero-UI Dashboard")

**Doc reference:** §6 ("Zero-UI dashboard" example), §26 Phase 2 item 4.

**Why second:** directly depends on 7.1's transport and Phase 6.1's
`ScoreBreakdown` — this is the doc's literal example: owner types "Show this
week's visibility score" / "What should I fix first?" and gets a chat
reply, not a login.

**Scope:**
- A small intent classifier on inbound WhatsApp/SMS text limited to the
  doc's two named intents (`show_score`, `whats_next`) — explicitly not a
  general chatbot; anything outside these two intents falls through to the
  existing approval-reply handling unchanged.
- `show_score` renders the Phase 6.1 `ScoreBreakdown` as a compact chat
  card (score, trend, top driver).
- `whats_next` renders the `nextBestFix` field plus its estimated point
  impact, the same phrasing pattern as the doc's example: "Your biggest
  issue is duplicate listings. Fixing this could improve your score by 8
  points."

**Exit criteria:** both intents work over the channel set up in 7.1/existing
SMS, using only data already computed in Phase 6 — no new score logic here.

---

## 7.3 Owner Edit Loop v2 + Creative Memory

**Doc reference:** §19, §26 Phase 2 items 5-6.

**Why third:** depends on 7.1's richer card transport to capture
free-text edit replies cleanly, but the memory model itself is independent
storage work that can proceed in parallel with 7.1/7.2 if resourced.

**Current state:** `handleEditRewriteReply` (`src/approval/index.ts`)
already handles an EDIT reply by drafting a rewrite — v1 has no persistence
of *why* the owner asked for a change.

**Scope:**
- Classify each edit reply into one of the doc's tracked categories:
  rejected phrase, preferred CTA, tone correction, image style preference,
  platform preference, forbidden claim, service emphasis, offer to avoid.
  A fixed category set, not open-ended free-text storage.
- Persist classified edits per business as `brand_memory` rows.
- Content generation (`src/content-engine/generate.ts`) reads
  `brand_memory` for the business and avoids previously-rejected
  phrases/tones — applied as a filter/bias on generation, not a guarantee,
  since this is pattern application, not strict enforcement.

**Exit criteria:** an edit made in week 1 measurably changes (or is at least
checked against) content generated in week 2+ for the same business; no
edit classification is invented for categories the owner didn't actually
trigger.

---

## 7.4 Surface Model (Feed / Story / Reel / Short / Carousel)

**Doc reference:** §26 Phase 2 item 7.

**Why fourth:** this is the prerequisite for review-to-content (7.5)
producing the right *shape* of content per platform (e.g. a testimonial
quote card vs. a Reel), and for Phase 8's A/B testing to vary across
surfaces meaningfully.

**Current state:** `src/content-engine/generate.ts` already distinguishes
`image` vs `video` via `MediaType` and `VIDEO_PLATFORMS`
(tiktok/youtube/vimeo/instagram/facebook as of the current session).

**Scope:**
- Add a `surface` dimension alongside `MediaType`: `feed | story | reel |
  short | carousel`, scoped only to platforms that actually distinguish
  these (Instagram: feed/story/reel/carousel; Facebook: feed/story/video;
  YouTube: video/short) — not invented for platforms without a real
  surface distinction.
- `generate.ts`'s per-platform brief selection extends to pick a surface,
  not just a media type, defaulting every existing platform to its current
  single surface (`feed`/`video`) so this is additive, not a behavior
  change for anything not explicitly extended.

**Exit criteria:** at least Instagram can target `story` or `reel` distinctly
from `feed`, with existing single-surface platforms unaffected.

---

## 7.5 Content Calendar Backend

**Doc reference:** §26 Phase 2 item 8.

**Why fifth:** needs 7.4's surface model to schedule the right content type
per slot, and 6.2's posting-cadence field from the profile.

**Scope:**
- A `content_calendar` table: business, planned date, platform, surface,
  status (`planned`/`generated`/`approved`/`posted`/`skipped`) — backend
  data model only, no UI; the existing weekly batch job
  (`src/jobs/weeklyBatch.ts`) reads/writes against it instead of generating
  content ad hoc per run.
- Cadence from `BusinessProfile` (6.2) determines how many calendar slots
  per week per platform.

**Exit criteria:** the weekly batch becomes calendar-driven (what's planned
for this week) rather than purely reactive, with no change to what actually
gets posted for businesses that haven't set a custom cadence.

---

## 7.6 Review-to-Content Workflow

**Doc reference:** §20, §26 Phase 2 item 9.

**Why sixth:** depends on 7.4's surface model (a testimonial becomes a
quote-card `feed` post or a `reel`, not just a generic image) and ties into
existing `sentiment-tracker/`.

**Scope:**
- Positive-review path: when `sentiment-tracker` records a high-rating
  review, generate a quote-card content item (reusing
  `generateImage`/`generateVideo` with a review-quote prompt) and add it to
  the content calendar (7.5) rather than posting unreviewed.
- Negative-review path: draft a response (reusing the existing
  review-triggered tone logic already in `content-engine/`) and escalate
  to the owner via the approval channel (7.1) instead of auto-posting
  anything — negative-review handling is response-drafting only in this
  phase, not the doc's further "suppress content on repeated theme" item,
  which depends on theme-detection work not yet scoped.

**Exit criteria:** a 5-star review can produce a real, owner-approved
testimonial post within the existing approval flow; a 1-star review
produces a drafted response awaiting owner action, never an automatic
public reply.

---

## 7.7 Next-Best-Fix Engine

**Doc reference:** §26 Phase 2 item 10.

**Why last:** this is largely Phase 6.1's `nextBestFix` field made
recurring/trackable rather than a new computation — sequenced last because
it's the thinnest item once 6.1 exists.

**Scope:**
- Track `nextBestFix` suggestions over time per business (suggested →
  acted-on / ignored) so the weekly digest (6.5) and chat card (7.2) can
  show "you fixed X last week" instead of repeating stale advice.
- No new signal sources — this is bookkeeping on top of 6.1's existing
  lookup table.

**Exit criteria:** a fix suggested and then resolved (e.g. duplicate
listing count drops to 0) stops being suggested and is acknowledged in the
next report instead.

---

## Explicitly out of scope for Phase 7

A/B creative testing, boost policy engine, vertical platform priority maps,
multi-location data model, agency white-label, Agent Action Queue,
Tool-Calling Intent Router — all doc Phase 3 items, covered in
`PHASE_8_SCOPE.md`. No dashboard of any kind, per doc §5/§24 (unchanged
constraint from Phase 6).

## Build order

7.1 → 7.2 → 7.4 → 7.5 → 7.6 → 7.7, with 7.3 (edit loop/creative memory)
proceeding in parallel once 7.1's transport exists — it has no dependency
on 7.4-7.7.
