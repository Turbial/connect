import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { isAuthorized, parseBearerToken } from "./auth.js";
import { isKnownToolName, matchRoute } from "./router.js";
import { callTool, getToolCatalog, type ToolName } from "../tools/registry.js";
import { credentialFieldsFor } from "../lib/platformCredentials.js";
import type { Platform } from "../types.js";

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
export async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const method = req.method ?? "GET";
  const path = req.url ?? "/";
  const route = matchRoute(method, path);

  if (!route) {
    sendJson(res, 404, { error: "Not found" });
    return;
  }

  if (route.kind === "health") {
    sendJson(res, 200, { status: "ok" });
    return;
  }

  const token = parseBearerToken(req.headers.authorization);
  if (!isAuthorized(token, process.env.CONNECT_AGENT_API_KEY)) {
    sendJson(res, 401, { error: "Unauthorized" });
    return;
  }

  if (route.kind === "list_tools") {
    sendJson(res, 200, { tools: getToolCatalog() });
    return;
  }

  if (route.kind === "platform_credential_fields") {
    sendJson(res, 200, { platform: route.platform, fields: credentialFieldsFor(route.platform as Platform) });
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

const isMain = process.argv[1] && process.argv[1].endsWith("server.ts");
if (isMain) {
  const port = Number(process.env.AGENT_API_PORT ?? 8787);
  startAgentApiServer(port);
}
