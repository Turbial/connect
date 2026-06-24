# Phase 21 Tasks

## 1. Stripe Billing Integration
- [ ] Backend: `POST /billing/checkout` — create Stripe Checkout Session, return URL
- [ ] Backend: route + router kind `create_checkout`
- [ ] Frontend: Billing page "Choose" button calls checkout endpoint, redirects to Stripe
- [ ] Frontend: Show current plan from `business.package` field if set
- [ ] Env: STRIPE_SECRET_KEY, STRIPE_PRICE_IDS map

## 2. Support Ticket Backend
- [ ] DB: `create table if not exists support_ticket (id uuid primary key default gen_random_uuid(), business_id uuid references business(id), name text, email text, message text, created_at timestamptz default now())`
- [ ] Backend: `POST /support` — insert ticket, send email via SMTP/Resend if configured
- [ ] Route + router kind `support_ticket`
- [ ] Frontend: Support page posts to /support instead of mailto

## 3. PageSpeed + Mobile Signals
- [ ] Wire PageSpeed Insights API: GET `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url={website_url}&strategy=desktop`
- [ ] Parse `lighthouseResult.categories.performance.score` → store as lcp_score (0-100)
- [ ] Wire mobile: same endpoint with `strategy=mobile` → store mobile_friendly score
- [ ] Graceful skip when `business.website_url` is null

## 4. Structured Data Check
- [ ] Fetch `business.website_url`, scan HTML for `application/ld+json` script tag containing `LocalBusiness` type
- [ ] Store "true"/"false" signal based on real crawl result

## 5. Review Response Rate (now accurate)
- [ ] review-response-rate module already queries `review` table
- [ ] Update to check `response_text IS NOT NULL` instead of `suggested_reply`

## 6. Service Signals in Analytics
- [ ] Tool: `get_service_signals` — read latest signal per type for this business
- [ ] Frontend: Analytics page — new "Site Health" tab showing PageSpeed, mobile, structured-data, citation count, content freshness signals

## 7. Post-Now Confirmation UI
- [ ] Add confirm dialog before `post_content_now` executes (high-risk tool)

## 8. Real Pricing + Plan Detection
- [ ] Add real price IDs and amounts to PLANS
- [ ] Show "Current plan" badge on active plan card
