import type { ToolName } from "../tools/registry.js";

const TOOL_NAME_RE = /^[a-z_]+$/;

export type Route =
  | { kind: "health" }
  | { kind: "list_tools" }
  | { kind: "call_tool"; toolName: string }
  | { kind: "platform_credential_fields"; platform: string }
  | { kind: "create_business" }
  | { kind: "send_owner_verification"; businessId: string }
  | { kind: "confirm_owner_verification"; businessId: string };

/** Phase 10: pure request-path matching for the agent API, kept separate
 * from the http server itself so routing logic is unit-testable without
 * standing up a real listener. */
export function matchRoute(method: string, path: string): Route | null {
  const normalizedPath = path.split("?")[0].replace(/\/+$/, "") || "/";

  if (method === "GET" && normalizedPath === "/health") return { kind: "health" };
  if (method === "GET" && normalizedPath === "/tools") return { kind: "list_tools" };

  const callMatch = /^\/tools\/([a-z_]+)$/.exec(normalizedPath);
  if (method === "POST" && callMatch && TOOL_NAME_RE.test(callMatch[1])) {
    return { kind: "call_tool", toolName: callMatch[1] };
  }

  const platformFieldsMatch = /^\/platforms\/([a-z]+)\/credential-fields$/.exec(normalizedPath);
  if (method === "GET" && platformFieldsMatch) {
    return { kind: "platform_credential_fields", platform: platformFieldsMatch[1] };
  }

  if (method === "POST" && normalizedPath === "/businesses") return { kind: "create_business" };

  const sendVerificationMatch = /^\/businesses\/([^/]+)\/owner-verification\/send$/.exec(normalizedPath);
  if (method === "POST" && sendVerificationMatch) {
    return { kind: "send_owner_verification", businessId: sendVerificationMatch[1] };
  }

  const confirmVerificationMatch = /^\/businesses\/([^/]+)\/owner-verification\/confirm$/.exec(normalizedPath);
  if (method === "POST" && confirmVerificationMatch) {
    return { kind: "confirm_owner_verification", businessId: confirmVerificationMatch[1] };
  }

  return null;
}

const KNOWN_TOOL_NAMES: ToolName[] = [
  "get_operator_snapshot",
  "get_visibility_score",
  "get_connection_health",
  "get_pending_approvals",
  "queue_content",
  "propose_boost",
  "run_visibility_audit",
  "set_platform_credentials",
];

export function isKnownToolName(name: string): name is ToolName {
  return (KNOWN_TOOL_NAMES as string[]).includes(name);
}
