import type { Platform } from "../types.js";
import { statusOfPartnerAccess } from "./partnerAccessRisk.js";

/**
 * Per the development program (Phase 1.1): every platform's real integration
 * state, so distribution and reporting can stop treating stub/unverified
 * platforms as if they actually publish content.
 *
 * - verified: real adapter, posting and insights confirmed working.
 * - partner_gated: real adapter exists, but posting access depends on
 *   partner-program approval that hasn't been confirmed yet.
 * - sandbox: real adapter exists against a documented API, but hasn't been
 *   run against a live production account yet.
 * - stub: Phase 12 generic adapter — no real API call, synthetic post id,
 *   zeroed insights.
 */
export type PlatformStatus = "verified" | "sandbox" | "partner_gated" | "stub" | "unsupported";

const TIER1_STATUS: Partial<Record<Platform, PlatformStatus>> = {
  gbp: "sandbox",
  facebook: "verified",
  instagram: "verified",
  pinterest: "sandbox",
  twitter: "sandbox",
  linkedin: "sandbox",
  threads: "sandbox",
  yelp: "partner_gated",
  nextdoor: "partner_gated",
  snapchat: "sandbox",
  tiktok: "partner_gated",
  youtube: "sandbox",
  whatsapp: "sandbox",
  reddit: "sandbox",
  bluesky: "sandbox",
  mastodon: "sandbox",
  tumblr: "sandbox",
  wechat: "partner_gated",
  telegram: "sandbox",
  discord: "sandbox",
  medium: "sandbox",
  vk: "sandbox",
  line: "sandbox",
  vimeo: "sandbox",
  flickr: "sandbox",
  foursquare: "sandbox",
  bing: "sandbox",
  applebusiness: "partner_gated",
  houzz: "partner_gated",
  angi: "partner_gated",
  thumbtack: "partner_gated",
  tripadvisor: "partner_gated",
  opentable: "partner_gated",
  quora: "sandbox",
  trustpilot: "sandbox",
  yandex: "sandbox",
};

const platformStatus: Record<Platform, PlatformStatus> = new Proxy(
  {} as Record<Platform, PlatformStatus>,
  {
    get(_target, platform: string) {
      return TIER1_STATUS[platform as Platform] ?? "stub";
    },
  }
);

export function statusOf(platform: Platform): PlatformStatus {
  return platformStatus[platform];
}

/** Every platform with a real adapter behind it (verified, sandbox, or
 * partner_gated) — i.e. the platforms TIER1_STATUS actually tags, as opposed
 * to the much larger Platform union most of which default to "stub" with no
 * adapter at all. */
function platformsWithRealAdapter(): Platform[] {
  return Object.keys(TIER1_STATUS) as Platform[];
}

export interface GatedPlatformEntry {
  platform: Platform;
  status: PlatformStatus;
  reason: string;
}

export interface PlatformStatusReport {
  verifiedCount: number;
  organicOnlyCount: number;
  totalAdaptersBuilt: number;
  gatedPlatforms: GatedPlatformEntry[];
}

function gatingReason(platform: Platform, status: PlatformStatus): string {
  const risk = statusOfPartnerAccess(platform);
  if (status === "sandbox") {
    return "Real adapter built against the documented API, but not yet run against a live production account.";
  }
  if (risk.partnerApprovalRequired === "required") {
    return "Partner-program approval is required and has not been confirmed yet.";
  }
  if (risk.partnerApprovalRequired === "likely") {
    return "Partner-program approval is likely required and has not been confirmed yet.";
  }
  return "Posting access is not yet confirmed for this platform.";
}

/** Per Phase 6.6: a single source of truth for any platform-count claim the
 * product makes (audit report, email digest, marketing copy) — generated
 * directly from the existing platformStatus/partnerAccessRisk tagging so the
 * claim can never drift from reality. Deliberately does not enumerate the
 * full Platform union's "stub" platforms (most have no real adapter at all)
 * to avoid implying a padded platform count. */
export function platformStatusReport(): PlatformStatusReport {
  const adapters = platformsWithRealAdapter();
  const verifiedCount = adapters.filter((p) => statusOf(p) === "verified").length;
  const gated = adapters
    .filter((p) => statusOf(p) === "sandbox" || statusOf(p) === "partner_gated")
    .map((p) => ({ platform: p, status: statusOf(p), reason: gatingReason(p, statusOf(p)) }));

  return {
    verifiedCount,
    organicOnlyCount: gated.length,
    totalAdaptersBuilt: adapters.length,
    gatedPlatforms: gated,
  };
}

/** Only these statuses represent a platform that actually publishes a real,
 * customer-facing post. Everything else must never be counted as "posted"
 * in distribution or reporting. */
export function isLivePlatform(platform: Platform): boolean {
  const status = statusOf(platform);
  return status === "verified" || status === "sandbox" || status === "partner_gated";
}
