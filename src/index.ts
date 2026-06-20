import "dotenv/config";
import http from "node:http";
import { supabase } from "./lib/supabase.js";
import { handleSmsReply, handleEditRewriteReply } from "./approval/index.js";
import { hasPendingBoost, handleBoostReply } from "./approval/boost.js";
import { handleReachReview } from "./reach-integration/index.js";
import { getConnectionSummary } from "./lib/platformConnection.js";
import { getLatestVisibilityScore } from "./visibility-score/index.js";
import { buildOrgWeeklyReport } from "./reporting/index.js";
import { statusOfPartnerAccess, PARTNER_ACCESS_RISK } from "./lib/partnerAccessRisk.js";
import { platformStatusReport } from "./lib/platformStatus.js";
import { handleMissedCall } from "./lib/missedCallTextback.js";
import { recordCustomerMessage, getLatestInboundChannel } from "./lib/customerMessaging.js";
import { sendApprovalSms } from "./approval/sms.js";
import { sendApprovalWhatsapp, whatsappButtonToText } from "./approval/whatsapp.js";
import { sendOwnerVerificationCode, confirmOwnerVerification } from "./lib/ownerVerification.js";
import { classifyChatIntent, buildChatIntentReply } from "./chat/scoreCard.js";
import { buildOperatorSnapshot } from "./lib/operatorSnapshot.js";
import { verifyTwilioWebhook, verifyMetaWebhook, verifyReachWebhook, verifyBusinessRoute } from "./lib/webhookAuth.js";
import type { Business, Platform } from "./types.js";

/** Phase 7.1: dispatches a decision (already-resolved text, e.g. "yes"/"no"/
 * "edit" from a WhatsApp button click, or the raw SMS body) for a business —
 * shared by the SMS and WhatsApp webhooks so both channels run through the
 * exact same boost/edit/approval decision code. */
async function dispatchApprovalReply(business: Business, text: string): Promise<void> {
  const normalized = text.trim().toLowerCase();
  if (normalized.startsWith("boost") || (await hasPendingBoost(business.id))) {
    await handleBoostReply(business, text);
  } else if (await handleEditRewriteReply(business.id, text)) {
    // A pending EDIT-rewrite proposal took priority and was resolved by this reply.
  } else {
    await handleSmsReply(business.id, text);
  }
}

async function handleSmsWebhook(req: http.IncomingMessage, res: http.ServerResponse) {
  let body = "";
  for await (const chunk of req) body += chunk;
  const params = new URLSearchParams(body);
  const from = params.get("From");
  const text = params.get("Body");

  if (!verifyTwilioWebhook("/webhooks/sms", params, req.headers["x-twilio-signature"] as string | undefined)) {
    res.writeHead(403).end();
    return;
  }

  if (!from || !text) {
    res.writeHead(400).end();
    return;
  }

  const { data: business, error } = await supabase
    .from("business")
    .select("*")
    .eq("owner_phone", from)
    .maybeSingle();

  if (error) {
    res.writeHead(404).end();
    return;
  }

  // Phase 4.2: a reply from a configured chain step's phone (not the owner's)
  // resolves content approval for whichever business in that step's org
  // currently has a pending chain-gated request — handleSmsReply already
  // walks the chain once it knows the business, so this only needs to find
  // the business the step's reply applies to.
  const resolvedBusiness = business ?? (await resolveBusinessFromChainStepPhone(from));
  if (!resolvedBusiness) {
    res.writeHead(404).end();
    return;
  }

  // Phase 7.2: show_score/whats_next chat intents are checked before the
  // boost/edit/approval dispatch — neither overlaps with YES/NO/EDIT/BOOST
  // syntax, so this can't intercept a real approval decision.
  const intent = classifyChatIntent(text);
  if (intent) {
    const reply = await buildChatIntentReply(resolvedBusiness.id, intent);
    if (resolvedBusiness.owner_phone) await sendApprovalSms(resolvedBusiness.owner_phone, reply);
    res.writeHead(200, { "Content-Type": "text/xml" }).end("<Response></Response>");
    return;
  }

  // A BOOST-prefixed reply, or any pending boost prompt, takes priority over content approval
  // so an owner replying to a boost SMS with plain "yes" still resolves the boost, not content.
  await dispatchApprovalReply(resolvedBusiness as Business, text);

  res.writeHead(200, { "Content-Type": "text/xml" }).end("<Response></Response>");
}

/** Phase 7.1: WhatsApp Business API inbound webhook (Meta's standard
 * messages-change payload shape). Button-click replies carry an
 * `interactive.button_reply.id`; users who type instead of tapping send a
 * plain `text.body` — both resolve to plain text via whatsappButtonToText
 * and dispatch through the exact same decision code as an SMS reply. */
async function handleWhatsappWebhook(req: http.IncomingMessage, res: http.ServerResponse) {
  let body = "";
  for await (const chunk of req) body += chunk;

  if (!verifyMetaWebhook(body, req.headers["x-hub-signature-256"] as string | undefined)) {
    res.writeHead(403).end();
    return;
  }

  let payload;
  try {
    payload = JSON.parse(body);
  } catch {
    res.writeHead(400).end();
    return;
  }

  const message = payload?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  const from: string | undefined = message?.from;
  const rawReply: string | undefined = message?.interactive?.button_reply?.id ?? message?.text?.body;

  if (!from || !rawReply) {
    res.writeHead(200).end();
    return;
  }

  const { data: byPhone, error: phoneError } = await supabase.from("business").select("*").eq("owner_phone", from).maybeSingle();
  if (phoneError) throw phoneError;
  const { data: byMobile, error: mobileError } = byPhone
    ? { data: null, error: null }
    : await supabase.from("business").select("*").eq("owner_mobile", from).maybeSingle();
  if (mobileError) throw mobileError;
  const business = byPhone ?? byMobile;

  if (!business) {
    res.writeHead(404).end();
    return;
  }

  // Phase 7.2: only a free-text reply (not a button-click id) can carry a
  // show_score/whats_next intent.
  const intent = classifyChatIntent(rawReply);
  if (intent) {
    const reply = await buildChatIntentReply(business.id, intent);
    await sendApprovalWhatsapp(from, reply);
    res.writeHead(200).end();
    return;
  }

  await dispatchApprovalReply(business as Business, whatsappButtonToText(rawReply));
  res.writeHead(200).end();
}

/** Phase 4.2: finds the business a chain-step phone's reply applies to — the
 * step belongs to an org, and within that org the business with a pending
 * (un-responded) chain-gated approval_request is the one awaiting this
 * step's decision. Returns null if the phone isn't a configured chain step,
 * or no business in that org has a pending chain-gated request. */
async function resolveBusinessFromChainStepPhone(phone: string): Promise<Business | null> {
  const { data: step } = await supabase.from("approval_chain_step").select("organization_id").eq("phone", phone).maybeSingle();
  if (!step) return null;

  const { data: orgBusinesses, error } = await supabase.from("business").select("*").eq("organization_id", step.organization_id);
  if (error || !orgBusinesses || orgBusinesses.length === 0) return null;

  const businessIds = orgBusinesses.map((b) => b.id);
  const { data: queuedItems } = await supabase.from("content_item").select("id, business_id").in("business_id", businessIds).eq("status", "queued");
  if (!queuedItems || queuedItems.length === 0) return null;

  const { data: pendingRequest } = await supabase
    .from("approval_request")
    .select("content_item_id")
    .in("content_item_id", queuedItems.map((i) => i.id))
    .not("chain_step_index", "is", null)
    .is("responded_at", null)
    .limit(1)
    .maybeSingle();
  if (!pendingRequest) return null;

  const item = queuedItems.find((i) => i.id === pendingRequest.content_item_id);
  return (orgBusinesses.find((b) => b.id === item?.business_id) as Business) ?? null;
}

async function handleReachWebhook(req: http.IncomingMessage, res: http.ServerResponse) {
  if (!verifyReachWebhook(req.headers.authorization)) {
    res.writeHead(401).end();
    return;
  }

  let body = "";
  for await (const chunk of req) body += chunk;

  let payload;
  try {
    payload = JSON.parse(body);
  } catch {
    res.writeHead(400).end();
    return;
  }

  if (!payload.business_id || !payload.review_id) {
    res.writeHead(400).end();
    return;
  }

  await handleReachReview(payload);
  res.writeHead(200).end();
}

async function handleConnectionsRoute(req: http.IncomingMessage, res: http.ServerResponse, businessId: string) {
  const summary = await getConnectionSummary(businessId);
  res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(summary));
}

/** Phase 6.4: kicks off owner phone verification — the weekly loop is gated
 * on owner_verified_at being set (see jobs/weeklyBatch.ts), and this is the
 * only way to start that gate from outside a developer seeding rows. */
async function handleSendOwnerVerificationRoute(req: http.IncomingMessage, res: http.ServerResponse, businessId: string) {
  const { data: businessRow, error } = await supabase.from("business").select("*").eq("id", businessId).maybeSingle();
  if (error) throw error;
  if (!businessRow) {
    res.writeHead(404).end();
    return;
  }
  await sendOwnerVerificationCode(businessRow as Business);
  res.writeHead(200).end();
}

async function handleConfirmOwnerVerificationRoute(req: http.IncomingMessage, res: http.ServerResponse, businessId: string) {
  let body = "";
  for await (const chunk of req) body += chunk;
  let payload: { code?: string };
  try {
    payload = JSON.parse(body);
  } catch {
    res.writeHead(400).end();
    return;
  }
  if (!payload.code) {
    res.writeHead(400).end();
    return;
  }

  const verified = await confirmOwnerVerification(businessId, payload.code);
  res.writeHead(verified ? 200 : 400, { "Content-Type": "application/json" }).end(JSON.stringify({ verified }));
}

async function handleVisibilityScoreRoute(req: http.IncomingMessage, res: http.ServerResponse, businessId: string) {
  const score = await getLatestVisibilityScore(businessId);
  if (!score) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(score));
}

/** Phase 8.9: read-only operator snapshot — visibility score, connection
 * health, pending approvals/boosts, unresolved reviews, and the recent
 * agent_action audit trail, all assembled from data already computed by
 * prior phases. */
async function handleOperatorSnapshotRoute(req: http.IncomingMessage, res: http.ServerResponse, businessId: string) {
  const snapshot = await buildOperatorSnapshot(businessId);
  if (!snapshot) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(snapshot));
}

/** Phase 4.3: consolidated multi-location report for an agency/org. */
async function handleOrgReportRoute(req: http.IncomingMessage, res: http.ServerResponse, organizationId: string) {
  const report = await buildOrgWeeklyReport(organizationId);
  res.writeHead(200, { "Content-Type": "text/plain" }).end(report);
}

/** Phase 5.1: the partner-access risk register — only platforms with a real,
 * filled-in entry are returned (the rest would just be noise: an "unknown,
 * unassessed" object repeated ~70 times). Use statusOfPartnerAccess(platform)
 * directly to look up any single platform, including unassessed ones. */
async function handlePartnerAccessRiskRoute(req: http.IncomingMessage, res: http.ServerResponse) {
  const register = (Object.keys(PARTNER_ACCESS_RISK) as Platform[]).map((platform) => statusOfPartnerAccess(platform));
  res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(register));
}

/** Phase 6.6: truth-labeled platform status view — the single source any
 * platform-count claim should be generated from, instead of authored
 * separately and risking drift from the real adapter/status tagging. */
async function handlePlatformStatusRoute(req: http.IncomingMessage, res: http.ServerResponse) {
  res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(platformStatusReport()));
}

/** Phase 5.3: Twilio call-status webhook for missed-call text-back. Resolves
 * the business by the number the customer called — business.phone is reused
 * as "the number customers call," matching its existing meaning elsewhere in
 * the codebase (there's no separate inbound-number column). */
async function handleMissedCallWebhook(req: http.IncomingMessage, res: http.ServerResponse) {
  let body = "";
  for await (const chunk of req) body += chunk;
  const params = new URLSearchParams(body);
  const from = params.get("From");
  const to = params.get("To");

  if (!verifyTwilioWebhook("/webhooks/missed-call", params, req.headers["x-twilio-signature"] as string | undefined)) {
    res.writeHead(403).end();
    return;
  }

  if (!from || !to) {
    res.writeHead(400).end();
    return;
  }

  const { data: business, error } = await supabase.from("business").select("id").eq("phone", to).maybeSingle();
  if (error || !business) {
    res.writeHead(404).end();
    return;
  }

  await handleMissedCall(business.id, from);
  res.writeHead(200, { "Content-Type": "text/xml" }).end("<Response></Response>");
}

/** Phase 5.3: owner (or future agent) reply to a customer thread. Looks up
 * the channel from the most recent inbound message for that identifier; only
 * "sms" actually sends (via the existing sendApprovalSms) — other channels
 * just record the row since there's no real webchat/DM send integration to
 * call yet, rather than faking a send. */
async function handleCustomerMessageReplyRoute(req: http.IncomingMessage, res: http.ServerResponse, businessId: string) {
  let body = "";
  for await (const chunk of req) body += chunk;

  let payload;
  try {
    payload = JSON.parse(body);
  } catch {
    res.writeHead(400).end();
    return;
  }

  if (!payload.customer_identifier || !payload.body) {
    res.writeHead(400).end();
    return;
  }

  const channel = await getLatestInboundChannel(businessId, payload.customer_identifier);
  if (!channel) {
    res.writeHead(404).end();
    return;
  }

  if (channel === "sms") {
    await sendApprovalSms(payload.customer_identifier, payload.body);
  }

  await recordCustomerMessage({
    businessId,
    channel,
    direction: "outbound",
    customerIdentifier: payload.customer_identifier,
    body: payload.body,
  });

  res.writeHead(200).end();
}

/** Phase 15 security hardening: every business/organization-scoped route
 * below exposes operator data and state-changing actions keyed only on a
 * UUID in the path — a UUID is not a valid trust boundary once combined with
 * those side effects, so each of these also requires the same bearer token
 * the agent-facing API uses (CONNECT_AGENT_API_KEY), checked before the
 * route's handler ever runs. */
function isAuthorizedBusinessRoute(req: http.IncomingMessage): boolean {
  return verifyBusinessRoute(req.headers.authorization);
}

/** Webhook receiver for inbound Twilio SMS replies and Reach review events. */
export function startWebhookServer(port: number): ReturnType<typeof http.createServer> {
  const server = http.createServer(async (req, res) => {
    if (req.method === "POST" && req.url === "/webhooks/sms") {
      await handleSmsWebhook(req, res);
      return;
    }
    if (req.method === "POST" && req.url === "/webhooks/whatsapp") {
      await handleWhatsappWebhook(req, res);
      return;
    }
    if (req.method === "POST" && req.url === "/webhooks/reach-review") {
      await handleReachWebhook(req, res);
      return;
    }
    if (req.method === "POST" && req.url === "/webhooks/missed-call") {
      await handleMissedCallWebhook(req, res);
      return;
    }
    if (req.method === "GET" && req.url === "/platforms/partner-access-risk") {
      await handlePartnerAccessRiskRoute(req, res);
      return;
    }
    if (req.method === "GET" && req.url === "/platforms/status") {
      await handlePlatformStatusRoute(req, res);
      return;
    }
    const connectionsMatch = req.method === "GET" && req.url?.match(/^\/businesses\/([^/]+)\/connections$/);
    const sendVerificationMatch = req.method === "POST" && req.url?.match(/^\/businesses\/([^/]+)\/owner-verification\/send$/);
    const confirmVerificationMatch = req.method === "POST" && req.url?.match(/^\/businesses\/([^/]+)\/owner-verification\/confirm$/);
    const visibilityScoreMatch = req.method === "GET" && req.url?.match(/^\/businesses\/([^/]+)\/visibility-score$/);
    const operatorSnapshotMatch = req.method === "GET" && req.url?.match(/^\/businesses\/([^/]+)\/operator-snapshot$/);
    const orgReportMatch = req.method === "GET" && req.url?.match(/^\/organizations\/([^/]+)\/report$/);
    const customerMessageReplyMatch = req.method === "POST" && req.url?.match(/^\/businesses\/([^/]+)\/messages$/);

    const isBusinessScopedRoute =
      connectionsMatch ||
      sendVerificationMatch ||
      confirmVerificationMatch ||
      visibilityScoreMatch ||
      operatorSnapshotMatch ||
      orgReportMatch ||
      customerMessageReplyMatch;

    if (isBusinessScopedRoute && !isAuthorizedBusinessRoute(req)) {
      res.writeHead(401).end();
      return;
    }

    if (connectionsMatch) {
      await handleConnectionsRoute(req, res, connectionsMatch[1]);
      return;
    }
    if (sendVerificationMatch) {
      await handleSendOwnerVerificationRoute(req, res, sendVerificationMatch[1]);
      return;
    }
    if (confirmVerificationMatch) {
      await handleConfirmOwnerVerificationRoute(req, res, confirmVerificationMatch[1]);
      return;
    }
    if (visibilityScoreMatch) {
      await handleVisibilityScoreRoute(req, res, visibilityScoreMatch[1]);
      return;
    }
    if (operatorSnapshotMatch) {
      await handleOperatorSnapshotRoute(req, res, operatorSnapshotMatch[1]);
      return;
    }
    if (orgReportMatch) {
      await handleOrgReportRoute(req, res, orgReportMatch[1]);
      return;
    }
    if (customerMessageReplyMatch) {
      await handleCustomerMessageReplyRoute(req, res, customerMessageReplyMatch[1]);
      return;
    }
    res.writeHead(404).end();
  });

  server.listen(port, () => console.log(`Distribution Layer listening on :${port}`));
  return server;
}

const isMain = process.argv[1] && /index\.(ts|js)$/.test(process.argv[1]);
if (isMain) {
  startWebhookServer(Number(process.env.PORT ?? 3000));
}
