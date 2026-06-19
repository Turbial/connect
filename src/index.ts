import "dotenv/config";
import http from "node:http";
import { supabase } from "./lib/supabase.js";
import { handleSmsReply } from "./approval/index.js";
import { hasPendingBoost, handleBoostReply } from "./approval/boost.js";
import { handleReachReview } from "./reach-integration/index.js";
import { getConnectionSummary } from "./lib/platformConnection.js";
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

  if (error || !business) {
    res.writeHead(404).end();
    return;
  }

  // A BOOST-prefixed reply, or any pending boost prompt, takes priority over content approval
  // so an owner replying to a boost SMS with plain "yes" still resolves the boost, not content.
  const normalized = text.trim().toLowerCase();
  if (normalized.startsWith("boost") || (await hasPendingBoost(business.id))) {
    await handleBoostReply(business as Business, text);
  } else {
    await handleSmsReply(business.id, text);
  }

  res.writeHead(200, { "Content-Type": "text/xml" }).end("<Response></Response>");
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
  res.writeHead(404).end();
});

const port = Number(process.env.PORT ?? 3000);
server.listen(port, () => console.log(`Distribution Layer listening on :${port}`));
