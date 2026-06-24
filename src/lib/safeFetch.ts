import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/** Phase 18 security hardening: media URLs supplied via post_content_now
 * flow straight into a server-side fetch() before re-upload to the target
 * platform, with no caller-side trust boundary (any authenticated business
 * account can supply one). Blocks SSRF against internal services/cloud
 * metadata endpoints by resolving the hostname and rejecting private,
 * loopback, link-local, and metadata address ranges before fetching. */
const BLOCKED_IPV4_RANGES: [string, number][] = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
];

function ipv4ToInt(ip: string): number {
  return ip.split(".").reduce((acc, part) => (acc << 8) + Number(part), 0) >>> 0;
}

function isBlockedIpv4(ip: string): boolean {
  const target = ipv4ToInt(ip);
  return BLOCKED_IPV4_RANGES.some(([base, bits]) => {
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return (target & mask) === (ipv4ToInt(base) & mask);
  });
}

function isBlockedIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  return (
    normalized === "::1" ||
    normalized === "::" ||
    normalized.startsWith("fe80:") || // link-local
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") || // unique local (fc00::/7)
    normalized.startsWith("::ffff:127.") ||
    normalized.startsWith("::ffff:169.254.") ||
    normalized.startsWith("::ffff:10.") ||
    normalized.startsWith("::ffff:192.168.")
  );
}

function isBlockedAddress(address: string): boolean {
  return isIP(address) === 4 ? isBlockedIpv4(address) : isBlockedIpv6(address);
}

/** Throws if `url` resolves to a private/loopback/link-local/metadata
 * address. Re-resolves at call time (not cached), so this must be called
 * immediately before each fetch — it does not protect against DNS
 * rebinding between this check and the actual request. */
async function assertPublicUrl(url: URL): Promise<void> {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`Refusing to fetch non-http(s) URL: ${url.protocol}`);
  }
  const hostname = url.hostname;
  if (isIP(hostname)) {
    if (isBlockedAddress(hostname)) {
      throw new Error(`Refusing to fetch URL resolving to a blocked address: ${hostname}`);
    }
    return;
  }
  const records = await lookup(hostname, { all: true });
  for (const record of records) {
    if (isBlockedAddress(record.address)) {
      throw new Error(`Refusing to fetch URL resolving to a blocked address: ${record.address}`);
    }
  }
}

/** Safe drop-in replacement for fetch() when the URL comes from a business
 * account rather than from our own server config — validates the resolved
 * destination isn't internal/private before issuing the request, and
 * re-validates after every redirect hop instead of letting fetch follow
 * redirects on its own. */
export async function safeFetch(input: string, init?: RequestInit, maxRedirects = 5): Promise<Response> {
  let url = new URL(input);
  for (let hop = 0; ; hop++) {
    await assertPublicUrl(url);
    const res = await fetch(url, { ...init, redirect: "manual" });
    if (res.status >= 300 && res.status < 400 && res.headers.has("location")) {
      if (hop >= maxRedirects) throw new Error("Too many redirects");
      url = new URL(res.headers.get("location")!, url);
      continue;
    }
    return res;
  }
}
