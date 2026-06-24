import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { isAuthorized, parseBearerToken } from "./auth.js";
import { isKnownToolName, matchRoute } from "./router.js";
import { contentTypeFor, staticFileFor } from "./staticFiles.js";
import { callTool, getToolCatalog, type ToolName } from "../tools/registry.js";
import { credentialFieldsFor } from "../lib/platformCredentials.js";
import { createBusiness } from "../lib/business.js";
import { sendOwnerVerificationCode, confirmOwnerVerification } from "../lib/ownerVerification.js";
import { extractBrandFromUrl } from "../lib/brandExtract.js";
import { createAccount, authenticateAccount, createSession, getAccountForToken, hasBusinessAccess, grantBusinessAccess } from "../lib/accounts.js";
import { supabase } from "../lib/supabase.js";
import type { Account, Business, Platform } from "../types.js";

const PUBLIC_DIR = fileURLToPath(new URL("./public", import.meta.url));

/** Serves the operator dashboard's static assets — unauthenticated, since the
 * dashboard itself holds no data; every API call it makes still requires the
 * bearer token entered into its own login field. */
async function serveStaticFile(res: ServerResponse, fileName: string): Promise<boolean> {
  try {
    const contents = await readFile(`${PUBLIC_DIR}/${fileName}`);
    res.writeHead(200, { "Content-Type": contentTypeFor(fileName) }).end(contents);
    return true;
  } catch {
    return false;
  }
}

const MAX_BODY_BYTES = 1_000_000;

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) });
  res.end(payload);
}

async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new Error("Request body too large");
    chunks.push(chunk as Buffer);
  }
  if (chunks.length === 0) return {};
  const raw = Buffer.concat(chunks).toString("utf-8");
  const parsed = JSON.parse(raw);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Request body must be a JSON object");
  }
  return parsed as Record<string, unknown>;
}

/** Phase 10: the agent-facing HTTP API — the doc's "agent is the dashboard"
 * thesis (PHASE_8_SCOPE.md addendum) made real. Any agent (Claude or
 * otherwise) holding a valid CONNECT_AGENT_API_KEY can discover the tool
 * catalog (`GET /tools`) and call a tool (`POST /tools/:name`) against a
 * specific business, with the exact same dry-run/approval/audit-log
 * behavior `callTool` already enforces for every other caller. */
/** Strips a configured base path prefix (e.g. CONNECT_BASE_PATH=/api, for a
 * reverse proxy that forwards the full path instead of stripping it before
 * proxying) so routing/static lookups always see the same paths they'd see
 * if served from the domain root. No-op when CONNECT_BASE_PATH is unset. */
export function stripBasePath(path: string): string {
  const basePath = process.env.CONNECT_BASE_PATH?.replace(/\/+$/, "");
  if (!basePath) return path;
  if (path === basePath) return "/";
  if (path.startsWith(`${basePath}/`)) return path.slice(basePath.length);
  return path;
}

export async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const method = req.method ?? "GET";
  const path = stripBasePath(req.url ?? "/");

  if (method === "GET") {
    const staticFile = staticFileFor(path);
    // Static files now resolve generically (Vite emits hashed asset names),
    // so a path that *looks* like an asset but is actually an API route
    // (e.g. /tools) must fall through to route matching below rather than
    // 404ing outright when no matching file exists on disk.
    if (staticFile && (await serveStaticFile(res, staticFile))) {
      return;
    }
  }

  const route = matchRoute(method, path);

  if (!route) {
    sendJson(res, 404, { error: "Not found" });
    return;
  }

  if (route.kind === "health") {
    sendJson(res, 200, { status: "ok" });
    return;
  }

  if (route.kind === "signup") {
    let body: Record<string, unknown>;
    try {
      body = await readJsonBody(req);
    } catch (err) {
      sendJson(res, 400, { error: err instanceof Error ? err.message : "Invalid request body" });
      return;
    }
    try {
      const account = await createAccount(body.email as string, body.password as string);
      const session = await createSession(account.id);
      sendJson(res, 201, { token: session.token, expiresAt: session.expiresAt });
    } catch (err) {
      sendJson(res, 400, { error: err instanceof Error ? err.message : "Failed to create account" });
    }
    return;
  }

  if (route.kind === "login") {
    let body: Record<string, unknown>;
    try {
      body = await readJsonBody(req);
    } catch (err) {
      sendJson(res, 400, { error: err instanceof Error ? err.message : "Invalid request body" });
      return;
    }
    try {
      const account = await authenticateAccount(body.email as string, body.password as string);
      if (!account) {
        sendJson(res, 401, { error: "Invalid email or password" });
        return;
      }
      const session = await createSession(account.id);
      sendJson(res, 200, { token: session.token, expiresAt: session.expiresAt });
    } catch (err) {
      sendJson(res, 400, { error: err instanceof Error ? err.message : "Failed to log in" });
    }
    return;
  }

  const token = parseBearerToken(req.headers.authorization);
  const masterAuthorized = isAuthorized(token, process.env.CONNECT_AGENT_API_KEY);
  let sessionAccount: Account | null = null;
  if (!masterAuthorized && token) {
    sessionAccount = await getAccountForToken(token);
  }
  if (!masterAuthorized && !sessionAccount) {
    sendJson(res, 401, { error: "Unauthorized" });
    return;
  }

  // A session account (as opposed to the master key) is scoped to only the
  // businesses it's been granted access to — the master key remains
  // unscoped for existing cron/automation callers.
  async function authorizeBusiness(businessId: string): Promise<boolean> {
    if (masterAuthorized) return true;
    if (!sessionAccount) return false;
    return hasBusinessAccess(sessionAccount.id, businessId);
  }

  if (route.kind === "list_tools") {
    sendJson(res, 200, { tools: getToolCatalog() });
    return;
  }

  if (route.kind === "platform_credential_fields") {
    sendJson(res, 200, { platform: route.platform, fields: credentialFieldsFor(route.platform as Platform) });
    return;
  }

  if (route.kind === "create_business") {
    let body: Record<string, unknown>;
    try {
      body = await readJsonBody(req);
    } catch (err) {
      sendJson(res, 400, { error: err instanceof Error ? err.message : "Invalid request body" });
      return;
    }
    try {
      const business = await createBusiness({
        name: body.name as string,
        location: body.location as string | undefined,
        phone: body.phone as string | undefined,
        ownerPhone: body.ownerPhone as string | undefined,
        ownerEmail: body.ownerEmail as string | undefined,
        ownerMobile: body.ownerMobile as string | undefined,
      });
      if (sessionAccount) await grantBusinessAccess(sessionAccount.id, business.id, "owner");
      sendJson(res, 201, { business });
    } catch (err) {
      sendJson(res, 400, { error: err instanceof Error ? err.message : "Failed to create business" });
    }
    return;
  }

  if (route.kind === "send_owner_verification") {
    if (!(await authorizeBusiness(route.businessId))) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }
    try {
      const { data: businessRow, error } = await supabase.from("business").select("*").eq("id", route.businessId).maybeSingle();
      if (error) throw error;
      if (!businessRow) {
        sendJson(res, 404, { error: "Business not found" });
        return;
      }
      await sendOwnerVerificationCode(businessRow as Business);
      sendJson(res, 200, { sent: true });
    } catch (err) {
      sendJson(res, 400, { error: err instanceof Error ? err.message : "Failed to send verification code" });
    }
    return;
  }

  if (route.kind === "confirm_owner_verification") {
    if (!(await authorizeBusiness(route.businessId))) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }
    let body: Record<string, unknown>;
    try {
      body = await readJsonBody(req);
    } catch (err) {
      sendJson(res, 400, { error: err instanceof Error ? err.message : "Invalid request body" });
      return;
    }
    const code = body.code as string | undefined;
    if (!code) {
      sendJson(res, 400, { error: '"code" is required' });
      return;
    }
    try {
      const verified = await confirmOwnerVerification(route.businessId, code);
      sendJson(res, verified ? 200 : 400, { verified });
    } catch (err) {
      sendJson(res, 500, { error: err instanceof Error ? err.message : "Failed to confirm verification code" });
    }
    return;
  }

  if (route.kind === "extract_brand") {
    if (!(await authorizeBusiness(route.businessId))) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }
    let body: Record<string, unknown>;
    try {
      body = await readJsonBody(req);
    } catch (err) {
      sendJson(res, 400, { error: err instanceof Error ? err.message : "Invalid request body" });
      return;
    }
    const url = body.url as string | undefined;
    if (!url) {
      sendJson(res, 400, { error: '"url" is required' });
      return;
    }
    try {
      const brand = await extractBrandFromUrl(url);
      sendJson(res, 200, { brand });
    } catch (err) {
      sendJson(res, 502, { error: err instanceof Error ? err.message : "Failed to extract brand" });
    }
    return;
  }

  if (route.kind === "oauth_start") {
    const { buildOAuthUrl } = await import("../lib/oauthFlow.js");
    const platform = route.platform as import("../lib/oauthFlow.js").OAuthPlatform;
    const validPlatforms = ["google", "facebook", "instagram"] as const;
    if (!(validPlatforms as readonly string[]).includes(platform)) {
      sendJson(res, 400, { error: `Unsupported OAuth platform "${platform}". Supported: ${validPlatforms.join(", ")}` });
      return;
    }
    const businessId = new URL(req.url ?? "/", "http://x").searchParams.get("businessId");
    if (!businessId) {
      sendJson(res, 400, { error: '"businessId" query param is required' });
      return;
    }
    if (!(await authorizeBusiness(businessId))) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }
    try {
      const state = Buffer.from(JSON.stringify({ platform, businessId })).toString("base64url");
      const url = buildOAuthUrl(platform, state);
      res.writeHead(302, { Location: url }).end();
    } catch (err) {
      sendJson(res, 500, { error: err instanceof Error ? err.message : "OAuth start failed" });
    }
    return;
  }

  if (route.kind === "oauth_callback") {
    const { exchangeCodeForTokens, tokenColumnsFor } = await import("../lib/oauthFlow.js");
    const qs = new URL(req.url ?? "/", "http://x").searchParams;
    const code = qs.get("code");
    const stateRaw = qs.get("state");
    const error = qs.get("error");
    if (error) {
      res.writeHead(302, { Location: "/#/platforms?oauth_error=" + encodeURIComponent(error) }).end();
      return;
    }
    if (!code || !stateRaw) {
      sendJson(res, 400, { error: "Missing code or state" });
      return;
    }
    let state: { platform: import("../lib/oauthFlow.js").OAuthPlatform; businessId: string };
    try {
      state = JSON.parse(Buffer.from(stateRaw, "base64url").toString("utf8"));
    } catch {
      sendJson(res, 400, { error: "Invalid state" });
      return;
    }
    if (!(await authorizeBusiness(state.businessId))) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }
    try {
      const tokens = await exchangeCodeForTokens(state.platform, code);
      const cols = tokenColumnsFor(state.platform);
      const update: Record<string, string> = { [cols.accessToken]: tokens.accessToken };
      if (cols.refreshToken && tokens.refreshToken) update[cols.refreshToken] = tokens.refreshToken;
      const { error: dbErr } = await supabase.from("business").update(update).eq("id", state.businessId);
      if (dbErr) throw dbErr;
      res.writeHead(302, { Location: `/#/platforms?oauth_success=${state.platform}` }).end();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "OAuth callback failed";
      res.writeHead(302, { Location: `/#/platforms?oauth_error=${encodeURIComponent(msg)}` }).end();
    }
    return;
  }

  if (route.kind === "upload") {
    const { createClient } = await import("@supabase/supabase-js");
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_KEY;
    if (!supabaseUrl || !supabaseServiceKey) {
      sendJson(res, 500, { error: "Storage not configured (SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY)" });
      return;
    }
    const contentType = req.headers["content-type"] ?? "application/octet-stream";
    if (!contentType.startsWith("image/") && !contentType.startsWith("video/")) {
      sendJson(res, 400, { error: "Only image/* and video/* uploads are supported" });
      return;
    }
    const ext = contentType.split("/")[1]?.split(";")[0] ?? "bin";
    const fileName = `upload-${Date.now()}.${ext}`;
    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      req.on("data", (chunk: Buffer) => chunks.push(chunk));
      req.on("end", resolve);
      req.on("error", reject);
    });
    const fileBuffer = Buffer.concat(chunks);
    const storage = createClient(supabaseUrl, supabaseServiceKey).storage;
    const { data, error: upErr } = await storage.from("connect-media").upload(fileName, fileBuffer, {
      contentType,
      upsert: false,
    });
    if (upErr) {
      sendJson(res, 500, { error: upErr.message });
      return;
    }
    const { data: urlData } = storage.from("connect-media").getPublicUrl(data.path);
    sendJson(res, 200, { url: urlData.publicUrl, path: data.path });
    return;
  }

  if (route.kind === "create_checkout") {
    let body: Record<string, unknown>;
    try { body = await readJsonBody(req); } catch (err) {
      sendJson(res, 400, { error: err instanceof Error ? err.message : "Invalid body" }); return;
    }
    const { businessId, planKey } = body as { businessId?: string; planKey?: string };
    if (!businessId || !planKey) { sendJson(res, 400, { error: '"businessId" and "planKey" are required' }); return; }
    if (!(await authorizeBusiness(businessId))) { sendJson(res, 403, { error: "Forbidden" }); return; }

    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) { sendJson(res, 503, { error: "Stripe is not configured on this server" }); return; }

    const priceIds: Record<string, string> = {
      local_operator: process.env.STRIPE_PRICE_LOCAL_OPERATOR ?? "",
      growth_operator: process.env.STRIPE_PRICE_GROWTH_OPERATOR ?? "",
      vertical_pro: process.env.STRIPE_PRICE_VERTICAL_PRO ?? "",
    };
    const priceId = priceIds[planKey as string];
    if (!priceId) { sendJson(res, 400, { error: `No Stripe price configured for plan "${planKey}"` }); return; }

    const baseUrl = process.env.CONNECT_BASE_URL ?? `http://localhost:${process.env.AGENT_API_PORT ?? 8787}`;
    try {
      const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${stripeKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          "line_items[0][price]": priceId,
          "line_items[0][quantity]": "1",
          mode: "subscription",
          success_url: `${baseUrl}/#/billing?checkout=success`,
          cancel_url: `${baseUrl}/#/billing?checkout=cancelled`,
          "metadata[businessId]": businessId,
          "metadata[planKey]": planKey as string,
        }),
      });
      if (!stripeRes.ok) {
        const err = await stripeRes.json() as { error?: { message?: string } };
        sendJson(res, 502, { error: err.error?.message ?? "Stripe error" }); return;
      }
      const session = await stripeRes.json() as { url: string };
      sendJson(res, 200, { url: session.url });
    } catch (err) {
      sendJson(res, 500, { error: err instanceof Error ? err.message : "Checkout failed" });
    }
    return;
  }

  if (route.kind === "support_ticket") {
    let body: Record<string, unknown>;
    try { body = await readJsonBody(req); } catch (err) {
      sendJson(res, 400, { error: err instanceof Error ? err.message : "Invalid body" }); return;
    }
    const { name, email, message, businessId } = body as Record<string, string | undefined>;
    if (!name?.trim() || !email?.trim() || !message?.trim()) {
      sendJson(res, 400, { error: '"name", "email", and "message" are required' }); return;
    }
    try {
      const { error: dbErr } = await supabase.from("support_ticket").insert({
        name: name.trim(), email: email.trim(), message: message.trim(),
        business_id: businessId ?? null,
      });
      if (dbErr) throw dbErr;

      // Fire-and-forget email if SUPPORT_EMAIL + RESEND_API_KEY are configured
      const resendKey = process.env.RESEND_API_KEY;
      const supportEmail = process.env.SUPPORT_EMAIL;
      if (resendKey && supportEmail) {
        fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "noreply@mightymaxconnect.com",
            to: supportEmail,
            subject: `Support request from ${name.trim()}`,
            text: `From: ${name.trim()} <${email.trim()}>\n\n${message.trim()}`,
          }),
        }).catch(() => {/* best-effort */});
      }
      sendJson(res, 201, { submitted: true });
    } catch (err) {
      sendJson(res, 500, { error: err instanceof Error ? err.message : "Failed to submit ticket" });
    }
    return;
  }

  // route.kind === "call_tool"
  if (!isKnownToolName(route.toolName)) {
    sendJson(res, 404, { error: `Unknown tool "${route.toolName}"` });
    return;
  }

  let body: Record<string, unknown>;
  try {
    body = await readJsonBody(req);
  } catch (err) {
    sendJson(res, 400, { error: err instanceof Error ? err.message : "Invalid request body" });
    return;
  }

  const { businessId, dryRun: dryRunRaw, ...input } = body;
  if (typeof businessId !== "string" || businessId.length === 0) {
    sendJson(res, 400, { error: "businessId is required" });
    return;
  }

  if (!(await authorizeBusiness(businessId))) {
    sendJson(res, 403, { error: "Forbidden" });
    return;
  }

  const dryRun = dryRunRaw === true;

  try {
    const result = await callTool(route.toolName as ToolName, businessId, { source: "external_agent", dryRun, input });
    const status = result.status === "failed" ? 502 : 200;
    sendJson(res, status, result);
  } catch (err) {
    sendJson(res, 500, { error: err instanceof Error ? err.message : "Internal error" });
  }
}

export function startAgentApiServer(port: number): ReturnType<typeof createServer> {
  if (!process.env.CONNECT_AGENT_API_KEY) {
    // eslint-disable-next-line no-console
    console.warn("CONNECT_AGENT_API_KEY is not set — every request to the agent API will be rejected.");
  }
  const server = createServer((req, res) => {
    handleRequest(req, res).catch((err) => {
      sendJson(res, 500, { error: err instanceof Error ? err.message : "Internal error" });
    });
  });
  server.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`Connect agent API listening on :${port}`);
  });
  return server;
}

const isMain = process.argv[1] && /server\.(ts|js)$/.test(process.argv[1]);
if (isMain) {
  const port = Number(process.env.AGENT_API_PORT ?? 8787);
  startAgentApiServer(port);
}
