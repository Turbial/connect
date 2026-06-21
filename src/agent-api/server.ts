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
import { createAccount, authenticateAccount, createSession, getAccountForToken, hasBusinessAccess, grantBusinessAccess } from "../lib/accounts.js";
import { supabase } from "../lib/supabase.js";
import type { Account, Business, Platform } from "../types.js";

const PUBLIC_DIR = fileURLToPath(new URL("./public", import.meta.url));

/** Serves the operator dashboard's static assets — unauthenticated, since the
 * dashboard itself holds no data; every API call it makes still requires the
 * bearer token entered into its own login field. */
async function serveStaticFile(res: ServerResponse, fileName: string): Promise<void> {
  try {
    const contents = await readFile(`${PUBLIC_DIR}/${fileName}`);
    res.writeHead(200, { "Content-Type": contentTypeFor(fileName) }).end(contents);
  } catch {
    res.writeHead(404).end();
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
    if (staticFile) {
      await serveStaticFile(res, staticFile);
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
