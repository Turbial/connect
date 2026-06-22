# MightyMax Connect — Standalone Product Strategy

## The Truthful Autonomous Marketing Operator

> Source strategy document. `PHASE_6_SCOPE.md`, `PHASE_7_SCOPE.md`, and
> `PHASE_8_SCOPE.md` translate this into codebase-grounded build plans,
> mirroring this doc's own 90-Day Roadmap (section 26). This file is kept
> verbatim as the reference; the phase-scope files are the actionable layer.

## Executive Verdict

Connect should become a standalone product.

Not a dashboard. Not a social scheduler. Not a marketing analytics toy. Not a
generic "AI content platform."

The right category is: **the autonomous local marketing operator** for small
businesses, agencies, franchises, and multi-location brands.

The product promise: Connect does the weekly local marketing work for you —
creates content, posts it, measures it, monitors your visibility, suggests
boosts, recovers missed leads, and only interrupts you when a real decision
is needed.

The strongest positioning: **Connect is the fractional CMO as software for
local businesses.** Local business owners do not want another app — they do
not want to learn Hootsuite, Buffer, Birdeye, Podium, Meta Ads Manager, GBP,
Yelp, Angi, Nextdoor, and Search Console. They want the work done.

Connect's moat is not the number of platforms. The moat is:
1. it does the work,
2. it refuses to fake results,
3. it gives one understandable Visibility Score,
4. it asks for owner approval only when needed,
5. it tells the truth about what is verified, sandboxed, partner-gated, or stubbed.

That truth-telling layer is not a footnote. It is the brand.

## 1. The Core Product Truth

Most local-marketing tools overclaim: they say they are omnichannel while many
integrations are shallow, they imply attribution they cannot prove, they show
dashboards nobody checks, they report vanity metrics instead of telling the
owner what changed.

Connect's strongest unusual quality is: **Connect refuses to lie.** The
verified/sandbox/partner-gated/stub platform tagging, explicit partner-access
risk register, and deliberate decision not to ship the performance-data
flywheel or partner API before the data is real — that is the core of the
brand.

The product should say: *Verified marketing automation. No fake platform
claims. No fake attribution. No fake dashboards.* This is not weakness. This
is differentiation — a growing number of buyers can tell when tools are
pretending.

## 2. Category Positioning

- Bad: "AI social media scheduler." (competes with Hootsuite, Buffer, Later, Metricool, Canva)
- Better: "AI marketing automation for local businesses." (still too broad)
- Strong: "Connect is the autonomous local visibility operator."
- Best: "Connect is a fractional CMO as software — running weekly local
  marketing for businesses that do not want another dashboard."

This gives permission to charge more. You are not selling a posting tool. You
are selling the job getting done.

## 3. The Wedge: Visibility Score

The Visibility Score should become the front door of the standalone product —
the only output the buyer can understand in five seconds: *"Am I more visible
than last week?"* That is the dashboard for people who do not want a
dashboard.

Product funnel:
1. Free or cheap local visibility audit.
2. Business receives a 0-100 Visibility Score.
3. Report explains what is dragging the score down.
4. Connect says: "Here is what we would fix this week."
5. Owner subscribes to the weekly operator loop.
6. Connect starts doing the work.
7. Weekly score trend proves improvement.

The score must be explainable, never a black box. Every report should show:
current score, previous score, score trend, top positive drivers, top
negative drivers, next best fix, competitor comparison, confidence level,
which data is verified, which data is missing. The score is defensible
because the inputs are real.

## 4. Visibility Score Formula

```text
Visibility Score = Σ(weight × signal_score) - penalties
```

Signal groups: social consistency, social engagement, review volume, review
sentiment, review response rate, listing accuracy, duplicate listing risk,
local search rank, SEO completeness, content freshness, competitor standing,
ads readiness, missed lead response, platform connection health. Each signal
normalized to 0-10. Weights change by vertical:

- **Restaurant:** reviews/sentiment high, GBP/Yelp/OpenTable high,
  Instagram/TikTok high, menu/listing accuracy high, LinkedIn low.
- **Home services:** GBP very high, reviews very high,
  Angi/Thumbtack/Nextdoor high, before/after content high, missed-call
  response very high, Instagram medium.
- **Med spa/beauty:** Instagram/TikTok very high, reviews high,
  before/after content high, Google visibility high, local reputation high.

A generic score is useful. A vertical-specific score is sellable.

## 5. Two Surfaces, Two Standards: Owner Experience vs. Operator Console

Connect has two distinct UI surfaces, and they must be held to different
standards. Conflating them is the mistake to avoid — not the existence of a
dashboard itself.

**Owner-facing surface: stays "Zero Dashboard."** The moment Connect becomes
another web app owners are supposed to check, it collapses into the same
category as everything else. The whole bet: owners do not log in, Connect
runs the work and messages them when needed.

Owner surfaces should be: SMS for simple decisions; WhatsApp/Messenger for
rich cards; email digest for weekly proof; lightweight approval links when a
visual preview is needed; onboarding/OAuth pages only when required.

Not: a daily dashboard, an analytics maze, a multi-tab reporting UI, an owner
social calendar to manage, a complicated content editor.

The owner experience should feel like "my marketing is being handled," not
"I have a new tool to use."

**Internal/operator console: a real, professional-grade dashboard.** The
team running Connect — internal staff, and eventually agency partners under
the white-label tier (section 11) — needs a full multi-tab console to manage
content, growth, reputation, revenue, platform connections, and settings
across many businesses. This console is not the product the local-business
owner is sold; it is the cockpit the operator uses to deliver the product.
Because it is a real working tool, not a marketing afterthought, it should
be held to standalone-product UI/UX standards, not internal-tool standards:

- A consistent design system (a real component/token library — e.g.
  Tailwind + a component kit — not a single hand-rolled stylesheet with
  hardcoded hex colors).
- Responsive layout with real breakpoints, not just `flex-wrap`.
- Accessibility as a baseline: `aria-*` attributes, visible focus states,
  alt text — not an afterthought.
- Every page header, loading state, empty state, and error state built from
  the shared component library — no page should fall back to raw
  `JSON.stringify` output or an unstyled `<input>`.
- No stubbed tabs in production ("not yet available" placeholders should be
  hidden or shipped, not left visible).

If the operator console looks unfinished, it does not just hurt internal
efficiency — it undermines the truth-telling brand (section 7): a product
that claims to refuse to fake results should not ship a console that looks
like it's faking polish.

## 6. The Messenger / WhatsApp Upgrade

SMS is a great v1 because it's universal, but limited. WhatsApp/Messenger as
the rich approval layer enables: image/video preview, approval/regenerate/edit
buttons, visibility score cards, weekly report cards, boost approval cards,
connection issue cards, carousel previews, structured decision flows.

Example approval card — generated content preview/caption/platform/schedule,
buttons: Approve & Post / Regenerate Image / Edit Caption / Hold.

Example boost card — post performance, why it qualifies, suggested budget,
budget remaining, buttons: Boost $25 / Boost $50 / Decline / Show me why.

Zero-UI dashboard via chat: owner types "Show this week's visibility score" →
Connect replies with a scorecard in chat. Owner types "What should I fix
first?" → Connect replies with the top fix and its score impact. This
preserves the no-dashboard philosophy while giving richer interaction.

## 7. Truth-Telling as Brand

Public language: "We do not fake platform coverage." "We do not report
synthetic results." "We label every integration honestly." "We only
recommend boosts when real signals justify it." "If a platform is
partner-gated, we tell you." "If attribution is uncertain, we say so."

Platform status language — instead of "Connect supports 35 platforms," say:
"Connect runs five platforms end-to-end today, can post organically to thirty
more where verified, and labels every sandbox, partner-gated, or stubbed
platform honestly." That phrasing is the product.

## 8. Verticalization Is the Highest-Leverage Expansion

The next major expansion move should not be generic platform count — it
should be verticalization, same engine, sharper edges. Each vertical needs a
different platform mix, content angles, review categories, competitor set,
sentiment issues, reporting cadence, boost logic, visibility score weights,
onboarding questions. A generic SMB pitch is hard; a restaurant product, a
home-services product, and a med-spa product are much easier to sell.

## 9. Vertical Product Lines

### 9.1 Connect for Home Services
Target: roofers, plumbers, electricians, HVAC, remodelers, landscapers,
handymen. Key platforms: GBP, Facebook, Instagram, YouTube Shorts, Nextdoor,
Angi, Thumbtack, Yelp, Bing Places. Content angles: before/after, completed
job, emergency service, seasonal maintenance, testimonial, local trust,
license/insurance, safety, service-area proof. Key metrics: calls, missed
calls recovered, reviews, GBP rank, service-area ranking, quote requests,
before/after engagement. Score weight: GBP rank, reviews, missed-call
response, listing consistency, before/after freshness, Angi/Thumbtack/
Nextdoor presence. **Probably the best first vertical.**

### 9.2 Connect for Restaurants
Target: restaurants, cafes, food trucks, bakeries, bars. Key platforms: GBP,
Instagram, TikTok, Yelp, OpenTable, TripAdvisor, Facebook, YouTube Shorts.
Content angles: dish spotlight, special of the week, behind the scenes,
customer review, staff story, local event, happy hour, seasonal menu,
delivery/takeout. Key metrics: reviews, sentiment, reservations, menu
visibility, profile views, calls/directions, food-visual engagement. Score
weight: review sentiment, Yelp/GBP/OpenTable status, food-photo freshness,
local search rank, Instagram/TikTok engagement.

### 9.3 Connect for Health, Beauty, and Wellness
Target: med spas, salons, dentists, clinics, gyms, chiropractors, personal
trainers. Key platforms: GBP, Instagram, TikTok, Facebook, Yelp, YouTube
Shorts, booking profile, local directories. Content angles: transformation,
testimonial, educational tip, before/after where allowed, trust/credentials,
seasonal offer, service explanation, FAQ, staff spotlight. Key metrics:
reviews, booking clicks, calls, before/after engagement, reputation
sentiment, compliance-safe content approval. Score weight: reviews,
Instagram/TikTok presence, trust signals, content freshness, booking
conversion, local rank.

## 10. Franchise and Multi-Location Tier

After verticalization, multi-location is the next revenue ceiling — a
franchisor buying Connect for 200 locations is a fundamentally different deal
than 200 individual owners buying separately. Build toward: corporate
dashboard for internal/operator use, location rollups, location-level
visibility scores, corporate vs local permissions, brand templates,
franchise-approved content, local override rules, location ranking,
connection health by location, bulk reports, white-label reports, regional
managers, permission hierarchy.

Permission model:
- **Corporate:** define brand rules, approve templates, see all locations,
  compare scores, set campaign themes, manage budgets.
- **Location owner:** approve local content, request edits, upload photos,
  approve boosts within limits, see their own weekly report.
- **Agency/operator:** manage all client accounts, troubleshoot connections,
  review queue, send reports, handle onboarding.

## 11. Agency White-Label as Distribution Channel

Agency white-label should be a real channel, not just a checkbox. Agency
promise: "Keep your brand. Connect does the weekly posting, reporting,
monitoring, and boost suggestions underneath." Agency gets: branded SMS
sender, white-label email reports, agency logo, client-level approval flows,
multi-client console, client billing support, service margins, rollup
reports, content review queue, connection health. Connect gets distribution
without hiring a large sales team — possibly the cheapest growth lever.

## 12. Platform Expansion Comes After Vertical Selection

Do not move platforms out of stub status randomly — each integration is real
engineering and often partner negotiation. Prioritize by vertical:
- **Home services first:** GBP Local Posts, Nextdoor, Angi, Thumbtack, Yelp,
  Facebook, Instagram, YouTube Shorts, Bing Places.
- **Restaurants first:** GBP, Yelp, OpenTable, TripAdvisor, Instagram,
  TikTok, Facebook, delivery surfaces if API access is practical.
- **Beauty/wellness first:** Instagram, TikTok, GBP, Yelp, Facebook,
  booking/review platforms, YouTube Shorts.

The platform roadmap should follow the vertical wedge. Do not chase logos.

## 13. Onboarding Is the Hidden Critical Path

Going from "local business signs up" to "Connect is actually posting,
monitoring, and reporting" is where the product either feels magical or feels
like setup hell. Onboarding must capture: business name, address/service
area, phone, website, owner mobile, owner preferred channel,
industry/vertical, services/menu/offers, brand tone, logo/photos, platforms
to connect, ad account access, budget policy, approval policy, competitor
list, target locations, preferred posting cadence, compliance restrictions.

First-value moment should not be "connect your accounts." It should be:
"Your Visibility Score is 47. Here are the three things hurting you most.
Connect can fix two of them this week." That is the conversion moment.

## 14. Standalone Product Flow

- **Acquisition:** free audit, visibility score, vertical-specific landing
  page, "what we would fix" report, SMS/email follow-up.
- **Activation:** guided onboarding, connect key platforms, owner channel
  verification, first content plan preview, first report baseline.
- **Operation (weekly loop):** generate content → approve or auto-post under
  policy → distribute → measure → run audit modules → detect
  reviews/messages/missed calls → propose boost if justified → send weekly
  report → recommend next best fix.
- **Retention:** score trend, visible work done, captured leads, fixed
  issues, better reviews, improved rank, successful boosts, fewer missed
  calls.

## 15. Tool-Calling Agent Architecture

Connect should eventually evolve from linear batch jobs into a tool-calling
operator, phased carefully — the weekly cron loop is good, do not destroy it;
instead add an agent layer above it.

Current model: `weekly batch → generate → approve → post → measure → boost → report`

Future model: `event or schedule → intent router → registered tools → action queue → policy check → execute or ask approval → log → report`

Registered tools (examples): `generate_content`, `revise_caption`,
`generate_image`, `generate_video`, `post_to_platform`, `collect_insights`,
`propose_boost`, `launch_boost`, `run_visibility_audit`,
`check_duplicate_listing`, `draft_review_reply`, `update_listing`,
`create_crm_lead`, `create_pm_task`, `generate_landing_page`,
`send_owner_report`.

Unified Agent Action Queue — every action becomes a record: source (weekly
job/owner message/customer message/review/missed call/performance trigger),
intent, tool, input, output, status, risk level, approval required, owner
response, platform result, error, retry count, audit log. This gives Connect
the architecture to expand beyond marketing scheduling.

## 16. CRM / PM Execution Bridge

Standalone Connect should not become a full CRM/PM tool, but should create
work when marketing signals require it. Example: customer comments "I need a
quote for roof repair" → Connect classifies as lead intent, logs the channel,
creates a CRM lead, creates a PM/sales task, notifies the owner/team,
optionally replies with a safe acknowledgment. If a CRM deal is marked won,
Connect can pause/adjust related ad spend, generate a testimonial/review
request later, create project-related content, update reporting attribution.

Keep the boundary clean: Connect detects and routes marketing/customer
signals; CRM manages sales records; PM manages fulfillment; Connect reports
marketing impact.

## 17. A/B Testing Before Boost

Before asking the owner to spend money: generate two captions, generate two
creative variants, test organically if possible, compare engagement, propose
a boost for the winner. Owner trust message: "We tested two versions. Version
B got 42% more engagement. Want to boost it for $25?" — much stronger than
"Want to boost this?"

## 18. Boost Policy Engine

Per business: max weekly spend, max daily spend, max boost per post,
auto-boost threshold, manual approval threshold, allowed platforms, excluded
services/offers, geographic radius, target audience, stop-loss conditions,
budget reset schedule, 5x hard safety cap. Example: "Auto-boost up to $15 when
a post beats baseline by 2x and weekly spend is under $50. Ask approval above
$15. Never exceed $250/week." This gives Connect graded autonomy.

## 19. Owner Edit Loop and Creative Memory

If the owner says "Less flashy," Connect should classify the edit, revise
content, store original and revised versions, learn the preference, apply it
to future content. Track: rejected phrases, preferred CTAs, tone corrections,
image style preference, platform preference, forbidden claims, services to
emphasize, offers to avoid, local language, owner approval patterns. This
becomes brand memory.

## 20. Review-to-Content and Review-to-Reputation

Reviews should become a central signal source.
- **Positive reviews:** generate quote cards, create testimonial reels,
  suggest social proof posts, propose ads from strong testimonials, update
  website testimonials if integrated.
- **Negative reviews:** draft response, escalate to owner, classify issue,
  identify repeated complaint themes, suppress public content using that
  theme until fixed.
- **Repeated themes:** create FAQ content, suggest service-page content,
  suggest business process fixes, feed sentiment score.

## 21. Email Digest as the Weekly Proof Layer

SMS/Messenger is for decisions; email is for proof. Weekly digest should
include: Visibility Score and change, top three actions completed, content
posted, best performing post, boost recommendation or result, reviews
summary, listing/rank/SEO issues, competitor movement, missed-call recovery,
next best fix, connection health issues, what needs owner attention. The
digest should be white-labelable for agencies.

## 22. No Flywheel or Partner API Until Data Is Real

Hold the line. Do not build fake network effects. Do not launch a partner API
before there are enough verified businesses and real outcomes. The
performance flywheel comes later when the system has enough businesses by
vertical, enough verified posts, enough real platform insights, enough boost
outcomes, enough revenue/lead signals. Until then, call it what it is: early
benchmark signals, not a flywheel. This honesty is part of the brand.

## 23. Product Packages

- **Starter Audit** — free/low-cost visibility audit, baseline score, top
  fixes, competitor snapshot, conversion path into subscription.
- **Local Operator** — weekly content, verified platform posting,
  SMS/Messenger approvals, weekly email digest, visibility score, review
  monitoring, missed-call text-back, basic boost proposals.
- **Growth Operator** — A/B creative testing, boost policy engine, paid boost
  proposals, deeper review-to-content, competitor monitoring, connection
  health, next-best-fix recommendations, local SEO/action monitoring.
- **Vertical Pro** — home services/restaurant/wellness playbooks,
  vertical-specific score weights, platform mix, templates, reports.
- **Agency/White-Label** — multi-client console, white-label reports,
  branded SMS/Messenger, role permissions, bulk approval, rollups, client
  billing support.
- **Franchise/Multi-Location** — corporate/location hierarchy, location
  rollups, brand governance, location comparisons, regional reports,
  multi-location scorecards, franchise templates.

## 24. What Not To Do

- Do not build a normal owner-facing dashboard — build onboarding, approval
  links, email reports, and chat cards instead. (The internal/operator
  console is a separate surface — see section 5 — and should be built to a
  professional standard, not skipped.)
- Do not market platform count as the main claim — "five full-loop
  platforms, thirty organic surfaces, every integration labeled truthfully"
  beats "108 platforms."
- Do not unlock platforms randomly — pick vertical first, then prioritize.
- Do not fake attribution — if a lead source is uncertain, say uncertain.
- Do not build flywheel/API too early — wait for real scale.
- Do not become a generic agency tool — own the operator category.
- Do not hide partner-gated risks — expose them internally and, when
  relevant, externally.

## 25. Strategic Build Order

First: onboarding + Visibility Score audit + Messenger/WhatsApp interactive
approval. Second: Tool-Calling Intent Router. Because the standalone product
needs a buyer experience before it needs a full agent architecture. The
first product must prove: business can onboard, score can be generated,
content can be approved easily, owner sees weekly proof, Connect feels like
an operator. The Tool-Calling Router is powerful but is a platform
architecture move — it should follow once the core owner experience is
strong.

## 26. 90-Day Roadmap

### Phase 1 — Standalone trust and onboarding (Days 1-30)
Goal: make Connect sellable and understandable as a standalone product.
Build: free/paid Visibility Score audit flow; vertical-specific audit report
for one beachhead vertical; business profile/brand kit; owner phone +
Messenger/WhatsApp verification; platform connection onboarding; connection
health states; weekly email digest v1; internal/operator console built to
the standalone-product UI standard defined in section 5 (real design
system, responsive layout, accessibility baseline, no stubbed tabs);
truth-labeled platform status view; pricing/package setup.
Success metric: a business can get a score, understand what's broken,
onboard, connect platforms, and approve the first weekly plan.

### Phase 2 — Zero-dashboard operator experience (Days 31-60)
Goal: make the owner experience feel like magic, not setup work.
Build: Messenger/WhatsApp approval cards; rich media post previews; boost
approval cards; visibility score card in chat; owner edit loop v2; creative
memory from owner edits; surface model (feed/story/reel/short/carousel);
content calendar backend; review-to-content workflow; next-best-fix engine.
Success metric: owner can run approvals, edits, boosts, and score checks
entirely from chat/email without logging into a dashboard.

### Phase 3 — Performance and vertical depth (Days 61-90)
Goal: move from activity automation to performance automation.
Build: A/B creative testing before boost; boost policy engine;
vertical-specific score weights; vertical-specific platform priority map;
paid boost performance report; multi-location data model; agency white-label
report v1; missed-call and customer-message lead routing; Agent Action Queue
v1; Tool-Calling Intent Router design + first implementation.
Success metric: Connect proves not only that work was done, but that
visibility improved and the right decisions were surfaced.

## 27. 12-Month Standalone Leadership Roadmap

- **Months 1-3 — Standalone productization:** audit-to-score acquisition
  funnel, onboarding, business profile, connection health,
  Messenger/WhatsApp approvals, weekly email digest, owner edit loop,
  content calendar, internal operator console.
- **Months 4-6 — Vertical domination:** home services/restaurant/wellness
  versions, vertical-specific score weights, vertical-specific platform
  integrations, vertical-specific reports, A/B testing, boost policy engine.
- **Months 7-9 — Agency and multi-location:** agency console, white-label
  SMS/email/Messenger, multi-location rollups, franchise permissions, brand
  governance, location comparisons, bulk approvals, corporate/location
  reporting.
- **Months 10-12 — Agentic platform layer:** Tool-Calling Intent Router,
  Agent Action Queue, CRM/PM event bridge, review-to-content-to-lead loop,
  customer-message routing, vertical benchmark signals, partner API only if
  data volume is real, performance flywheel only if verified outcome data
  exists.

## 28. Final Positioning

- Weak: "AI social media scheduler."
- Better: "AI local marketing automation."
- Strong: "Connect is the autonomous local marketing operator."
- Best: "Connect is fractional CMO as software: it runs your weekly local
  marketing, tells the truth about what worked, and only asks you for
  decisions that matter."

### Final Recommendation

Connect should become a standalone product, but not by copying dashboards. It
should win by being the truthful, zero-dashboard, autonomous operator for
local visibility. The core brand: *no fake integrations, no fake
attribution, no fake dashboards — just verified weekly marketing work.* The
wedge: Visibility Score. The expansion path: Visibility Score audit funnel →
verticalized product versions → Messenger/WhatsApp approval cards → email
digest proof layer → onboarding that feels magical → A/B testing before
boost → boost policy engine → agency white-label → franchise/multi-location
rollups → tool-calling agent architecture after the core experience works.

The deepest strategic point: **Connect should not help owners do marketing.
Connect should do the marketing and tell the owner the truth.** That is the
standalone path to a category-defining product.
