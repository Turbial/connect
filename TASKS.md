# Build Tasks

Each task is self-contained. Check the box when done.

---

## 1. Review Response ✅
- [x] **Tool:** `reply_to_review` — stores response_text + responded_at in review table
- [x] **DB:** `alter table review add column if not exists response_text text; responded_at timestamptz;`
- [x] **Registry:** `reply_to_review` tool added
- [x] **UI:** Reputation → Reviews tab — Reply button + inline textarea

## 2. OAuth Connect Flow ✅
- [x] **Backend:** `GET /oauth/start/:platform` — redirects to platform OAuth URL
- [x] **Backend:** `GET /oauth/callback/:platform` — exchanges code, stores token, redirects to /platforms
- [x] **Lib:** `src/lib/oauthFlow.ts` — Google, Facebook, Instagram URL builders + code exchange
- [x] **Router:** `oauth_start` and `oauth_callback` route kinds added
- [x] **UI:** Platforms → Connections tab — "Connect with {platform}" OAuth buttons
- [x] **Env:** GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, FB_APP_ID, FB_APP_SECRET, CONNECT_BASE_URL

## 3. Media Upload UI ✅
- [x] **Backend:** `POST /upload` — accepts image/* and video/*, stores to Supabase Storage, returns public URL
- [x] **Router:** `upload` route kind added
- [x] **UI:** Content → Library tab — file picker, upload progress, thumbnail preview, URL auto-fills
- [x] **UI:** Library table shows image thumbnail or video link for items with media

## 4. In-Dashboard Approve / Reject ✅
- [x] **Tool:** `approve_content` — sets content_item.status = "approved"
- [x] **Tool:** `reject_content` — sets content_item.status = "rejected"
- [x] **Registry:** both tools added
- [x] **UI:** Dashboard → Pending Approvals card — Approve / Reject buttons per row
- [x] **UI:** Content → Approvals tab — same buttons, shows caption preview

## 5. Analytics Charts ✅
- Analytics already had a custom SVG BarChart component (no charting library needed)
- Analytics page already uses BarChart for score history, platform breakdown, revenue
- Growth → Score tab uses existing DataTable (chart upgrade out of scope for this pass)
- Reputation → Sentiment already shows button to capture + display result

## 6. WhatsApp Reply Routing ✅
- [x] **Lib:** `replyViaWhatsApp()` added to customerMessaging.ts — uses Twilio WhatsApp API
- [x] **Types:** `CustomerMessage.channel` extended with `"whatsapp"`
- [x] **Tool:** `reply_to_customer` now dispatches to `replyViaWhatsApp` for `channel === "whatsapp"`
- [x] **UI:** Inbox — Reply button shown for both SMS and WhatsApp messages; routes to correct channel

## 7. Credential Encryption at Rest ✅
- [x] **Lib:** `src/lib/encryption.ts` — AES-256-GCM encrypt/decrypt
- [x] **Lib:** `platformCredentials.ts` — encrypts on write (when ENCRYPTION_KEY is set), decrypts on read
- [x] **Adapters:** GBP and YouTube adapters updated to decrypt tokens via `decryptCredential()`
- [x] **Env:** ENCRYPTION_KEY (64 hex chars / 32 bytes). Gracefully skipped if unset (backwards compatible).

## 8. meta_page_id Setup UI ✅
- [x] **Tool:** `set_meta_page_id` — updates business.meta_page_id
- [x] **Registry:** tool added
- [x] **UI:** Platforms → Meta Setup tab — Page ID input + Save button with instructions

## 9. Mobile Layout ✅
- [x] **CSS:** responsive nav — horizontal scroll, no-wrap on < 640px
- [x] **CSS:** grid — single column on mobile
- [x] **CSS:** `.row` — stacks vertically on mobile
- [x] **CSS:** tabs — horizontal scroll on overflow
- [x] **CSS:** table — scrollable on mobile
- [x] **CSS:** auth shell — full-width, reduced padding on mobile
- [x] **CSS:** page header — stacks on mobile
- [x] **CSS:** file input — dashed border style

---

## All tasks complete ✅

**New tools added (54 total):** reply_to_review, approve_content, reject_content, set_meta_page_id
**New routes:** GET /oauth/start/:platform, GET /oauth/callback/:platform, POST /upload
**New lib files:** src/lib/encryption.ts, src/lib/oauthFlow.ts
**Schema additions:** review.response_text, review.responded_at
