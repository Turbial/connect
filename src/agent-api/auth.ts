import { timingSafeEqual } from "node:crypto";

/** Phase 10: bearer-token auth for the agent-facing HTTP API. Fails closed —
 * if CONNECT_AGENT_API_KEY isn't configured, no request is ever authorized,
 * rather than the API silently running open. */
export function parseBearerToken(header: string | undefined | null): string | null {
  if (!header) return null;
  const match = /^Bearer (.+)$/.exec(header.trim());
  return match ? match[1] : null;
}

/** Constant-time comparison so a valid key can't be inferred by timing how
 * fast a wrong guess is rejected. */
export function isAuthorized(token: string | null, expectedKey: string | undefined): boolean {
  if (!expectedKey || !token) return false;
  const tokenBuf = Buffer.from(token);
  const expectedBuf = Buffer.from(expectedKey);
  if (tokenBuf.length !== expectedBuf.length) return false;
  return timingSafeEqual(tokenBuf, expectedBuf);
}
