import type { Platform } from "../types.js";

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

/** Only these statuses represent a platform that actually publishes a real,
 * customer-facing post. Everything else must never be counted as "posted"
 * in distribution or reporting. */
export function isLivePlatform(platform: Platform): boolean {
  const status = statusOf(platform);
  return status === "verified" || status === "sandbox" || status === "partner_gated";
}
