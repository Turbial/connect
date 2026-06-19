import "dotenv/config";
import http from "node:http";
import { supabase } from "./lib/supabase.js";
import { handleSmsReply, handleEditRewriteReply } from "./approval/index.js";
import { hasPendingBoost, handleBoostReply } from "./approval/boost.js";
import { handleReachReview } from "./reach-integration/index.js";
import { getConnectionSummary } from "./lib/platformConnection.js";
import { getLatestVisibilityScore } from "./visibility-score/index.js";
import { buildOrgWeeklyReport } from "./reporting/index.js";
import type { Business } from "./types.js";

async function handleSmsWebhook(req: http.IncomingMessage, res: http.ServerResponse) {
  let body = "";
  for await (const chunk of req) body += chunk;
  const params = new URLSearchParams(body);
  const from = params.get("From");
  const text = params.get("Body");

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

  // A BOOST-prefixed reply, or any pending boost prompt, takes priority over content approval
  // so an owner replying to a boost SMS with plain "yes" still resolves the boost, not content.
  const normalized = text.trim().toLowerCase();
  if (normalized.startsWith("boost") || (await hasPendingBoost(resolvedBusiness.id))) {
    await handleBoostReply(resolvedBusiness as Business, text);
  } else if (await handleEditRewriteReply(resolvedBusiness.id, text)) {
    // A pending EDIT-rewrite proposal took priority and was resolved by this reply.
  } else {
    await handleSmsReply(resolvedBusiness.id, text);
  }

  res.writeHead(200, { "Content-Type": "text/xml" }).end("<Response></Response>");
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

async function handleVisibilityScoreRoute(req: http.IncomingMessage, res: http.ServerResponse, businessId: string) {
  const score = await getLatestVisibilityScore(businessId);
  if (!score) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(score));
}

/** Phase 4.3: consolidated multi-location report for an agency/org. */
async function handleOrgReportRoute(req: http.IncomingMessage, res: http.ServerResponse, organizationId: string) {
  const report = await buildOrgWeeklyReport(organizationId);
  res.writeHead(200, { "Content-Type": "text/plain" }).end(report);
}

/** Webhook receiver for inbound Twilio SMS replies and Reach review events. */
const server = http.createServer(async (req, res) => {
  if (req.method === "POST" && req.url === "/webhooks/sms") {
    await handleSmsWebhook(req, res);
    return;
  }
  if (req.method === "POST" && req.url === "/webhooks/reach-review") {
    await handleReachWebhook(req, res);
    return;
  }
  const connectionsMatch = req.method === "GET" && req.url?.match(/^\/businesses\/([^/]+)\/connections$/);
  if (connectionsMatch) {
    await handleConnectionsRoute(req, res, connectionsMatch[1]);
    return;
  }
  const visibilityScoreMatch = req.method === "GET" && req.url?.match(/^\/businesses\/([^/]+)\/visibility-score$/);
  if (visibilityScoreMatch) {
    await handleVisibilityScoreRoute(req, res, visibilityScoreMatch[1]);
    return;
  }
  const orgReportMatch = req.method === "GET" && req.url?.match(/^\/organizations\/([^/]+)\/report$/);
  if (orgReportMatch) {
    await handleOrgReportRoute(req, res, orgReportMatch[1]);
    return;
  }
  res.writeHead(404).end();
});

const port = Number(process.env.PORT ?? 3000);
server.listen(port, () => console.log(`Distribution Layer listening on :${port}`));
