# Connect — Product Reference

Full description of every screen, feature, and backend capability. Use this to review, QA, and plan the next build.

---

## What Connect Is

Connect is an **AI-agent-first local business autopilot**. It sits between a small/multi-location business and its online presence (Google, Facebook, Instagram, Yelp, TikTok, etc.) and autonomously manages content posting, review reputation, local SEO, and customer messaging — surfacing only decisions that genuinely need a human.

The agent layer is first-class: every capability is a named tool callable by an AI agent OR a human operator through the dashboard. The dashboard is the human view into what the agent is doing.

---

## User Roles

| Role | Access |
|---|---|
| **Owner** | Full access, receives SMS/email approval requests, owner verification gate |
| **Staff** | Dashboard access, no SMS approval or billing |
| **Agent API key** | Programmatic tool calls on behalf of a business |

Multi-location: an **Organization** groups businesses. Agency/franchise operators see an org-level rollup and can manage all child businesses.

---

## Screens

### Login / Onboarding (`/`)

**Purpose:** Authenticate and wire up a business in three steps.

**Step 1 — Create Business**
- Fields: Business name (required), Location, Business phone, Owner phone (SMS approvals), Owner email, Owner mobile (WhatsApp)
- POST `businesses` → returns `business.id`
- Business ID stored in localStorage

**Step 2 — Owner Verification**
- Send 6-digit code to owner's phone via SMS
- Confirm the code to unlock the weekly content loop
- Can be skipped and completed later from Settings

**Step 3 — Connect First Platform**
- Type a platform name (e.g. `facebook`, `google`, `instagram`)
- Lookup dynamic credential fields per platform
- Save encrypted credentials → platform becomes active
- Can be skipped and done later from Platforms

**Sign-in panel** (collapsed by default)
- Email + password → POST `auth/login` → returns session token
- Sign-up creates a new account
- Token auto-fills the API key field

---

### Dashboard (`/`)

**Purpose:** Single-screen business health overview. Auto-loads on every visit.

**Cards:**

| Card | Data source | Actions |
|---|---|---|
| Visibility Score | `get_visibility_score` | Run fresh audit |
| Connections | `get_connection_health` | — |
| Pending Approvals | `get_pending_approvals` | — |
| Pending Boosts | `propose_boost` output | Evaluate boost triggers |
| Unresolved Reviews | `get_operator_snapshot` | — |
| Recent Agent Actions | `agent_action` table | — |

**Visibility Score card** shows: score (0–100), trend direction, score drivers (each with label + impact), and the next best fix recommendation.

**Connections card** shows each platform's status (`verified` / `needs_reconnection` / `disconnected`) with color-coded tags and an `actionRequired` flag.

---

### Content (`/content`)

**Purpose:** Manage the full content lifecycle — from AI drafts to scheduled posts to a reusable library.

**Tabs:**

#### Calendar
- Weekly slot grid from `get_calendar_slots`
- Each slot: platform, scheduled date, status (planned / approved / posted)
- `plan_calendar_week` previews how many slots the current cadence setting would create

#### Library
- Org-wide reusable content items (`content_library_item` table, scoped to organization)
- Add item: caption, comma-separated platforms, optional media URL + type
- Remove any item
- Uses `get_content_library` / `add_to_library` / `remove_from_library`

#### Approvals
- Drafts waiting for owner approval (`get_pending_approvals`)
- Each item shows caption, platforms, created date
- Owner approves/rejects via SMS reply; this tab is the agent-side view

#### Published
- All posted content (`get_content_calendar` filtered to posted)

#### Performance
- `analyze_content_performance` — ranks all posts by engagement score + velocity
- Shows views, clicks, calls per post

#### Trending
- `flag_trending_content` — posts climbing faster than the baseline engagement rate
- Useful for identifying organic content worth boosting

#### Predictor
- `predict_draft_score` — input a draft caption, get a predicted engagement score vs. historical average
- Helps the agent (and operator) pre-screen drafts before queuing

---

### Growth (`/growth`)

**Purpose:** Track and improve the business's local search visibility, SEO, and paid/organic boost activity.

**Tabs:**

#### Score
- Current Local Visibility Score with full driver breakdown
- Historical trend chart (`get_visibility_score_history`)
- Next best fix recommendation

#### Boosts
- All proposed boosts (`get_boost_history`) — declined and launched
- Each boost shows: post, threshold that triggered it, owner response, ad platform, budget
- Trigger a fresh boost evaluation

#### Competitors
- Add competitors by name/Google Place ID
- `capture_competitor_snapshots` — pull fresh rating + review counts
- `get_competitor_comparison` — own score vs. competitors side by side

#### Local Search & SEO
- `run_seo_audit` — citation completeness, NAP consistency, GBP completeness (0–100)
- `get_seo_audit_history` — audit trend over time
- `track_rank` — input a keyword, capture local search rank
- `get_rank_history` — rank over time per keyword
- `check_duplicate_listings` — flag potential duplicate GBP entries
- `sync_listing_info` — push NAP updates to all connected platforms

---

### Reputation (`/reputation`)

**Purpose:** Monitor reviews, respond to trends, and track sentiment.

**Tabs:**

#### Sentiment
- `capture_sentiment_trend` — computes 30-day average rating and NLP sentiment (positive / negative / neutral)
- NLP uses keyword scoring on review text; result stored as `nlp_positive_pct` (0–100)
- Trend chart over time

#### Reviews
- All reviews from `review` table
- Columns: rating, customer name, text
- Unresolved reviews highlighted (no response logged)
- Source: `reach` integration or direct ingestion

#### Duplicate Listings
- Output of `check_duplicate_listings`
- Each flagged entry: candidate place ID, name, address
- Action: resolve (mark as duplicate or dismiss)

---

### Inbox (`/inbox`)

**Purpose:** Unified customer messaging across SMS, missed calls, Instagram DMs, and Facebook DMs.

**Features:**
- Message list split into Inbound / Outbound
- Each message: channel, customer identifier (phone or handle), direction, intent classification, timestamp
- **Reply:** compose and send via `reply_to_customer` — routes to the correct channel (Twilio SMS or Meta DM)
- Intent auto-classified by `classifyMessageIntent` (booking / complaint / question / lead / other)

**Inbound channels:**
| Channel | Source |
|---|---|
| `sms` | Twilio SMS webhook |
| `missed_call` | Twilio call-status webhook → text-back |
| `dm_instagram` | Meta Social webhook (Instagram DM) |
| `dm_facebook` | Meta Social webhook (Facebook DM) |
| `whatsapp` | Meta WhatsApp Business webhook |

---

### Platforms (`/platforms`)

**Purpose:** Manage platform connections, credentials, and understand integration coverage.

**Tabs:**

#### Connections
- Live status per platform (`get_connection_health`)
- Each row: platform name, status tag, actionRequired flag
- Status values: `verified` (green) / `sandbox` (yellow) / `needs_reconnection` (red) / `disconnected`

#### Platform Coverage
- Fetches `GET /platforms/status` (not a tool call — direct API)
- Shows every platform adapter and its tier:
  - **verified** — live OAuth/API, full posting capability
  - **sandbox** — staging/test integration
  - **partner_gated** — requires partner program approval (e.g. TikTok)
  - **stub** — defined but not yet implemented
- Tier summary counts at top; DataTable of all platforms below

#### Credentials
- Select a platform → look up its required credential fields
- Input fields (password-masked) per platform
- Save via `set_platform_credentials`

---

### Analytics (`/revenue`)

**Purpose:** Revenue attribution and content performance by platform.

**Tabs:**

#### Visibility Score Trend
- `get_visibility_score_history` → line chart of score over time

#### Platform Breakdown
- `get_platform_breakdown` — posts, views, clicks, calls per platform
- Table + summary

#### Revenue by Platform
- `lead_event` table — calls, form fills, bookings, Stripe payments attributed to content
- Grouped by source platform and content item

---

### Settings (`/settings`)

**Purpose:** Configure all business-level settings.

**Tabs:**

#### Business Profile
- Edit: business name, location, phone, website, category
- `update_business_profile`

#### Owner Verification
- Re-send or re-confirm the owner verification code
- `send_owner_verification_code` / `confirm_owner_verification`

#### Posting Cadence
- Set posting frequency (e.g. "3 per week", "daily")
- `set_posting_cadence`
- Affects `plan_calendar_week` slot count

#### Autopilot
- Toggle autopilot on/off
- When on: approved content is posted automatically without re-asking the owner
- `set_autopilot`

#### Team
- List all accounts with access to this business (`list_team_members`)
- Add member by email (`add_team_member`)
- Toggle role: owner ↔ staff (`set_team_member_role`)
- Remove member (`remove_team_member`)

#### Org & Benchmark
- `get_org_visibility_rollup` — score rollup across all locations (agency/franchise)
- `get_vertical_benchmark` — own score vs. industry vertical average
- `get_agent_action_queue` — recent automated actions across the org

#### Report Branding
- Upload org logo URL, set brand color
- `set_report_branding` / `get_report_branding`
- Applied to weekly org reports (white-label)

---

### Billing (`/billing`)

**Purpose:** Plan selection and upgrade path.

**Plans:**

| Plan | Target |
|---|---|
| Starter Audit | Single location, audit only |
| Local Operator | Full autopilot, 1 location |
| Growth Operator | Boosts + competitors, 1 location |
| Vertical Pro | Industry benchmarks + advanced analytics |
| Agency | Multi-location management |
| Franchise | Franchise org rollup + white-label |

Features are gated by `hasFeature(business, featureName)` — checked at tool-call time.

---

### Support (`/support`)

**Purpose:** Contact form → opens mailto with pre-filled subject/body.

---

## Backend Systems

### Weekly Content Loop (`src/jobs/weeklyBatch.ts`)
1. For each active business: generate content drafts (AI captions per platform)
2. Create `approval_request` → send SMS/email to owner
3. Owner replies APPROVE/REJECT via SMS webhook
4. Approved items dispatched to each platform adapter
5. Boost evaluation runs after posting

### Scheduled Jobs (`src/jobs/`)

| Job | Frequency | What it does |
|---|---|---|
| `weeklyBatch` | Weekly | Draft → approve → post loop |
| `runServiceModules` | Daily | Competitor snapshots, sentiment, rank tracking |
| `runVisibilityScore` | Daily | Recompute Local Visibility Score |
| `collectPerformance` | Periodic | Poll post metrics (views/clicks/calls) |
| `checkConnections` | Periodic | Health-check all platform OAuth tokens |
| `orgBatch` | Weekly | Multi-location report generation |

### Webhook Handlers (`src/index.ts`)

| Route | Handler |
|---|---|
| `POST /webhooks/sms` | Twilio SMS → classify intent → route (approval / customer reply) |
| `POST /webhooks/whatsapp` | Meta WhatsApp → record customer message |
| `POST /webhooks/reach-review` | Ingest review from Reach |
| `POST /webhooks/missed-call` | Twilio missed call → auto text-back |
| `POST /webhooks/stripe` | Stripe checkout → lead event (revenue attribution) |
| `POST /webhooks/crm` | CRM/form/booking → lead event |
| `GET /webhooks/meta-social` | Meta hub.challenge verification |
| `POST /webhooks/meta-social` | Instagram/Facebook DM + comment ingestion |

### NLP Sentiment (`src/sentiment-tracker/`)
- Keyword-based scoring (no external API)
- `POSITIVE_WORDS` and `NEGATIVE_WORDS` sets
- `scoreText(text)` → `"positive" | "negative" | "neutral"`
- `nlp_positive_pct` (0–100) stored per sentiment trend record

### Local Visibility Score
- Computed from: GBP completeness, review rating/count, posting frequency, platform connection health, SEO audit score, rank data
- Drivers list explains each contributing factor with impact label
- `nextBestFix` = highest-impact single action the business can take

---

## Platform Integration Tiers

| Tier | Meaning | Examples |
|---|---|---|
| `verified` | Live API/OAuth, fully tested | Google, Facebook, Instagram |
| `sandbox` | Works but in staging/test mode | Some platforms pre-launch |
| `partner_gated` | Requires platform partner approval | TikTok, LinkedIn |
| `stub` | Defined, not yet implemented | Niche/future platforms |

---

## Data Model Summary

| Table | Key relationships |
|---|---|
| `business` | Core entity; has platform credential columns |
| `organization` + `account_business` | Multi-location + RBAC |
| `content_item` → `approval_request` → `post` | Draft → approve → dispatch |
| `boost_trigger` → `post` | Organic post → paid boost |
| `review` | Ingested from Reach or webhooks |
| `visibility_score` | Computed daily; drivers as JSON |
| `sentiment_trend` | 30-day avg + NLP pct |
| `competitor` → `competitor_snapshot` | Tracking over time |
| `rank_snapshot` | Keyword rank history |
| `lead_event` | Attribution: post → call/form/booking/Stripe |
| `customer_message` | Inbox: all inbound/outbound |
| `content_library_item` | Org-scoped reusable content |
| `content_calendar` | Slot planning per business |
| `agent_action` | Audit trail for every tool call |

---

## Known Gaps / Build-Upon Areas

### Features missing or partial
- **Review response:** Reviews are visible and tagged unresolved, but there is no "reply to review" tool or UI action for responding on Google/Yelp
- **Real-time boost execution:** `propose_boost` evaluates and records a boost proposal but does not call Facebook Ads / Google Ads API to actually launch it — that leg is a stub
- **OAuth connect flow:** Credentials are stored manually; there is no OAuth redirect flow (e.g., "Connect with Facebook" button that handles the OAuth handshake)
- **Media upload:** Content items support `media_url` but there is no UI for uploading an image/video — the URL must be entered manually
- **Push notifications:** Owners receive SMS/email approval requests but there is no in-app push notification or real-time update when something needs attention
- **Inbox pagination:** `get_inbox` returns messages since a date but the UI has no pagination or infinite scroll for long histories
- **Analytics charts:** Analytics tab has tabs for data but no actual chart rendering — data is in tables only
- **Approval from dashboard:** Pending approvals are visible on the dashboard but can only be approved/rejected via SMS; there is no in-dashboard approve/reject action
- **Mobile responsiveness:** Layout uses grid/flex but has not been tested or optimized for small screens

### Integration gaps
- `meta_page_id` on `business` table must be set manually — no UI to link a Facebook/Instagram page ID to a business
- WhatsApp inbound is ingested but `reply_to_customer` only routes to SMS; WhatsApp reply path is not implemented
- Stripe webhook records revenue attribution but there is no Stripe subscription management UI (billing page is static plan display only)

### Security / ops
- Platform credentials are stored as plaintext in `business` table columns — should be encrypted at rest
- No rate limiting on public webhook endpoints beyond HMAC verification
- `post_content_now` bypasses the owner approval gate entirely and is high-risk — no secondary confirmation in UI
