# Connect — Phase 14 Scope Plan: Content Intelligence

Follows directly from `src/content-analytics` (shipped this session) —
breaks the "tell a creator what's actually working and why" goal into
trackable sub-phases instead of one open-ended "more analytics" ask.

Each sub-phase ships independently: typecheck + full test suite green,
tool registry entry + dashboard surface added, before moving to the next.

## 14.1 — Structural performance diffing ✅ shipped

`src/content-analytics/index.ts`. Ranks posted content by a weighted
engagement score, splits into top/bottom performer groups, diffs 8
structural attributes (media type, surface, platform, caption length,
posting time, hashtag/emoji use, A/B variant), flags which differences are
significant (≥25pp gap). Tool: `analyze_content_performance`. Dashboard
card: "Content performance."

## 14.2 — Qualitative caption analysis (tone, hook, CTA) ✅ shipped

**Why next:** 14.1 only sees *structure* (length, hashtags) — it can't tell
you the top performer's first line asked a question while the bottom
performer's was a flat announcement. That's the difference a creator
actually wants explained.

**Plan:** one DeepSeek call (same pattern as `content-engine/capabilities.ts`)
given the top-N and bottom-N captions, asking it to identify *qualitative*
patterns Connect's structural diff can't see (hook style — question vs.
statement vs. urgency; presence of a specific CTA verb; voice/tone). Output
is itself a `PerformanceInsight`-shaped addition appended to the existing
`insights` array, not a replacement — so a caller who only wants the free,
structural version still gets it without an API key.

**Out of scope for 14.2:** no auto-rewrite of future captions based on this
yet — that's 14.5.

**Shipped as:** `analyzeCaptionQualities` in `src/content-analytics/index.ts`,
folded into `analyzeContentPerformance`'s `insights` array (attribute
`caption_quality`). Best-effort: no `DEEPSEEK_API_KEY`, a failed request, or
unparseable output all degrade to zero qualitative insights rather than
failing the tool call — 14.1's structural insights are never blocked on it.

## 14.3 — Trend/virality detection

**Why:** 14.1 compares finished totals. It can't tell a creator "this
post posted 6 hours ago is already outperforming 90% of what you've ever
posted" while it's still climbing — which is exactly the moment a boost or
a follow-up post matters most.

**Plan:** add a velocity metric (score growth between the last two
`last_polled_at` snapshots, or vs. the business's historical average at the
same age-since-posted) in `src/performance/index.ts`'s existing polling
loop. Surface a `flag_trending_content` read in the analytics module, and
consider wiring it into `trigger-engine` as an *earlier* boost signal than
the current fixed views/engagement threshold (additive, not a replacement
— the existing threshold stays as the floor).

**Shipped as:** a new `post_metric_snapshot` table (one row appended per
poll, same pattern as `rank_snapshot`/`sentiment_trend`), populated by
`collectPerformance` in `src/performance/index.ts`. `flagTrendingContent` in
`src/content-analytics/index.ts` reads each post's two most recent
snapshots, computes a score-per-hour velocity, and flags any post whose
velocity is at least double the business's own average velocity across its
other recently-polled posts. Tool: `flag_trending_content`. Dashboard card:
"Trending content." `trigger-engine/evaluateBoostTriggers` now also treats
a trending post as boost-eligible, in addition to (not instead of) the
existing fixed views/engagement threshold; a trend-detection failure is
caught and treated as "nothing trending" so it never blocks the existing
fixed-threshold path.

## 14.4 — Predictive draft scoring

**Why:** 14.1-14.3 explain the past. The highest-leverage next step is
using that history *before* a draft posts — score a queued
`content_item` against the attributes Phase 14.1/14.2 found significant
for this business, before it goes out for owner approval.

**Plan:** `predictDraftScore(business, draftItem)` in `content-analytics`,
reusing `diffAttributes`'s significant-insight output as the scoring
weights. Surface the score (and the one-line reason) alongside the draft in
the approval SMS/email/dashboard — not a hard gate, just visible signal,
consistent with the codebase's "advisory, owner decides" pattern everywhere
else (boost approval, edit-rewrite proposals).

**Shipped as:** `predictDraftScore(business, draftItem)` in
`src/content-analytics/index.ts`, reusing `diffAttributes`'s significant
structural insights (excluding `posting_time`, which an unposted draft has
no value for yet) as the scoring weights — score is the percentage of
applicable significant attributes the draft matches. Tool:
`predict_draft_score`. Wired into `src/approval/index.ts`'s weekly approval
message: each queued item gets a "Predicted fit: N/100 — reason" line,
best-effort (a lookup failure for one item just omits that item's line,
never blocks the approval send).

## 14.5 — Feed insights back into content generation

**Why:** closes the loop — once 14.1/14.2 reliably identify "video +
hashtags + a question hook outperforms," `content-engine`'s generation
brief should lean into that *by default* for this business, not just
report it after the fact.

**Plan:** `content-engine/index.ts`'s `generatePost` accepts an optional
style nudge sourced from the business's latest `analyzeContentPerformance`
significant insights (e.g. "favor video," "use a question-style hook") and
folds it into the DeepSeek prompt. Strictly additive/best-effort — content
generation must not start failing if analytics has no data yet (new
businesses, low post volume).

## Explicitly out of scope for Phase 14

Cross-business/competitor content benchmarking (Connect has no read access
to competitors' actual post content, only their public review/rating
signals via `competitor-monitor` — comparing captions would require data
Connect doesn't have and can't honestly claim to have). Automatic
unsupervised caption rewriting with no human review (every existing
approval/edit-rewrite flow in this codebase requires an owner YES, and this
phase doesn't change that). A dedicated analytics UI beyond the existing
operator dashboard card (no new frontend framework, consistent with the
project's no-heavy-dependencies convention).

## Tracking

- [x] 14.1 Structural performance diffing
- [x] 14.2 Qualitative caption analysis
- [x] 14.3 Trend/virality detection
- [x] 14.4 Predictive draft scoring
- [ ] 14.5 Feed insights back into content generation
