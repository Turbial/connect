import type { Platform } from "../types.js";

/**
 * Phase 5.1: per-platform partner-access risk register — the real roadmap for
 * platform expansion, not the adapter file count. Each entry answers: does a
 * usable API exist, does it support posting on behalf of unrelated/unaffiliated
 * businesses (vs. only the API owner's own account), is partner approval
 * required/likely, and what are the content/rate-limit rules.
 *
 * This is a living document a human should correct, not an authoritative
 * source. Entries below reflect training-knowledge judgment about each
 * platform's public developer-platform posture as of model cutoff, not a
 * verified-today audit — there is no internet access to confirm current
 * terms. Where genuinely uncertain, partnerApprovalRequired is "unknown"
 * rather than a confident guess. Only platforms with a real adapter (see
 * src/distribution/*.ts) get a defensible entry; everything else falls back
 * to an intentionally pessimistic "unassessed" default — that default does
 * NOT mean "fine," it means "nobody has checked."
 */
export interface PartnerAccessRisk {
  platform: Platform;
  apiExists: boolean;
  /** Can this platform's API post on behalf of unrelated/unaffiliated
   * businesses (a real multi-tenant distribution product), as opposed to
   * only the API owner's own single account/page? */
  supportsThirdPartyPosting: boolean;
  partnerApprovalRequired: "none" | "likely" | "required" | "unknown";
  rateLimitNotes: string | null;
  contentRestrictionNotes: string | null;
}

const UNASSESSED_DEFAULT: Omit<PartnerAccessRisk, "platform"> = {
  apiExists: false,
  supportsThirdPartyPosting: false,
  partnerApprovalRequired: "unknown",
  rateLimitNotes: null,
  contentRestrictionNotes: null,
};

/** Only the platforms with a real adapter/integration today (cross-referenced
 * against src/lib/platformStatus.ts's TIER1_STATUS map) get a filled-in,
 * defensible entry. Everything else resolves to UNASSESSED_DEFAULT below. */
export const PARTNER_ACCESS_RISK: Partial<Record<Platform, PartnerAccessRisk>> = {
  gbp: {
    platform: "gbp",
    apiExists: true,
    supportsThirdPartyPosting: true,
    partnerApprovalRequired: "required",
    rateLimitNotes: "Google Business Profile API has per-project quota; standard access tier requires a Basic/Standard API access request approved by Google.",
    contentRestrictionNotes: "Local Post content policy restricts promotional language and prohibits certain claim types; posts can be rejected post-hoc.",
  },
  facebook: {
    platform: "facebook",
    apiExists: true,
    supportsThirdPartyPosting: true,
    partnerApprovalRequired: "required",
    rateLimitNotes: "Graph API rate limits scale with Meta App usage tier; Advanced Access for pages_manage_posts requires App Review.",
    contentRestrictionNotes: "Meta Platform Terms and Community Standards apply; automated/scheduled posting must comply with Page publishing policies.",
  },
  instagram: {
    platform: "instagram",
    apiExists: true,
    supportsThirdPartyPosting: true,
    partnerApprovalRequired: "required",
    rateLimitNotes: "Instagram Graph API content publishing limit is 25 posts/24h per IG Business account; shares Meta App Review gating with Facebook.",
    contentRestrictionNotes: "Only image/video/carousel/reels supported via API; Stories publishing has separate, narrower availability.",
  },
  pinterest: {
    platform: "pinterest",
    apiExists: true,
    supportsThirdPartyPosting: true,
    partnerApprovalRequired: "likely",
    rateLimitNotes: "Standard API access has modest per-app rate limits; higher trial/standard tiers require an access request.",
    contentRestrictionNotes: "Pins must link to a live, policy-compliant destination URL; affiliate/spam link policies enforced.",
  },
  twitter: {
    platform: "twitter",
    apiExists: true,
    supportsThirdPartyPosting: true,
    partnerApprovalRequired: "none",
    rateLimitNotes: "Paid API tiers (Basic/Pro/Enterprise) required for meaningful posting volume since the free-tier overhaul; tight per-tier monthly post caps.",
    contentRestrictionNotes: "Automation rules require disclosure for bulk/scheduled behavior; standard platform policy otherwise.",
  },
  linkedin: {
    platform: "linkedin",
    apiExists: true,
    supportsThirdPartyPosting: true,
    partnerApprovalRequired: "required",
    rateLimitNotes: "Marketing Developer Platform access (needed for posting to Company Pages on behalf of others) requires a formal partner application and ongoing review.",
    contentRestrictionNotes: "Sharing API content policies prohibit certain promotional patterns; access can be revoked for policy violations.",
  },
  threads: {
    platform: "threads",
    apiExists: true,
    supportsThirdPartyPosting: true,
    partnerApprovalRequired: "required",
    rateLimitNotes: "Threads API publishing limit is 250 posts/24h per user; shares Meta App Review gating.",
    contentRestrictionNotes: "Meta Community Standards apply; API is newer and less battle-tested for third-party tools.",
  },
  yelp: {
    platform: "yelp",
    apiExists: true,
    supportsThirdPartyPosting: false,
    partnerApprovalRequired: "required",
    rateLimitNotes: "Fusion API is read-mostly; there is no general-purpose public API for posting business updates/offers on Yelp's behalf.",
    contentRestrictionNotes: "Yelp has historically been restrictive about automated business-facing tools; partner program access is narrow and case-by-case.",
  },
  nextdoor: {
    platform: "nextdoor",
    apiExists: true,
    supportsThirdPartyPosting: false,
    partnerApprovalRequired: "required",
    rateLimitNotes: "Business posting API access is limited to approved partners; no open self-serve developer signup for general posting.",
    contentRestrictionNotes: "Neighborhood-content policies are stricter than typical social platforms; promotional content is curtailed.",
  },
  snapchat: {
    platform: "snapchat",
    apiExists: true,
    supportsThirdPartyPosting: false,
    partnerApprovalRequired: "likely",
    rateLimitNotes: "Public content publishing APIs are oriented around Snap Ads/Creative Kit, not generic third-party organic posting on behalf of unrelated businesses.",
    contentRestrictionNotes: "Unassessed beyond ad-platform content policy; organic business posting access is unclear.",
  },
  tiktok: {
    platform: "tiktok",
    apiExists: true,
    supportsThirdPartyPosting: true,
    partnerApprovalRequired: "required",
    rateLimitNotes: "Content Posting API requires app audit before unaudited/sandbox limits are lifted; per-app daily post quotas apply.",
    contentRestrictionNotes: "Unaudited apps can only post to private/draft visibility; commercial content disclosure required for branded content.",
  },
  youtube: {
    platform: "youtube",
    apiExists: true,
    supportsThirdPartyPosting: true,
    partnerApprovalRequired: "required",
    rateLimitNotes: "YouTube Data API v3 quota is a shared daily unit pool per project; default quota is low and an audit/quota increase request is needed for production-scale uploading on behalf of many channels.",
    contentRestrictionNotes: "OAuth verification (and for some scopes, a YouTube API Services audit) is required before going beyond 100 users in testing.",
  },
  whatsapp: {
    platform: "whatsapp",
    apiExists: true,
    supportsThirdPartyPosting: true,
    partnerApprovalRequired: "required",
    rateLimitNotes: "WhatsApp Business Platform messaging limits scale by phone number quality rating/tier; Meta Business verification required for production access.",
    contentRestrictionNotes: "Template message approval required for business-initiated conversations outside the 24h customer-service window.",
  },
  reddit: {
    platform: "reddit",
    apiExists: true,
    supportsThirdPartyPosting: true,
    partnerApprovalRequired: "none",
    rateLimitNotes: "OAuth API rate limits are per-app/per-client; commercial use above free tier now requires a paid API agreement.",
    contentRestrictionNotes: "Subreddit-level rules (often anti-self-promotion) are enforced by moderators, not the API itself — high real-world rejection risk even with API access.",
  },
  bluesky: {
    platform: "bluesky",
    apiExists: true,
    supportsThirdPartyPosting: true,
    partnerApprovalRequired: "none",
    rateLimitNotes: "AT Protocol/Bluesky API is open and self-serve with app-password or OAuth auth; generous default rate limits.",
    contentRestrictionNotes: "Standard community guidelines; no special commercial-posting restriction known.",
  },
  mastodon: {
    platform: "mastodon",
    apiExists: true,
    supportsThirdPartyPosting: true,
    partnerApprovalRequired: "none",
    rateLimitNotes: "Self-serve per-instance OAuth app registration; rate limits vary by instance (it's federated, not one company).",
    contentRestrictionNotes: "Instance-specific rules vary widely since each Mastodon server sets its own policy.",
  },
  tumblr: {
    platform: "tumblr",
    apiExists: true,
    supportsThirdPartyPosting: true,
    partnerApprovalRequired: "none",
    rateLimitNotes: "Self-serve OAuth app registration; standard per-app rate limits.",
    contentRestrictionNotes: "Standard community guidelines; no special partner gate known for posting.",
  },
  wechat: {
    platform: "wechat",
    apiExists: true,
    supportsThirdPartyPosting: false,
    partnerApprovalRequired: "required",
    rateLimitNotes: "Official Account API access tier (and most posting capability) requires a verified China-registered business entity; foreign/unverified accounts have severely limited API surface.",
    contentRestrictionNotes: "Content review is stricter and subject to PRC regulation; high rejection/ban risk for non-compliant content.",
  },
  telegram: {
    platform: "telegram",
    apiExists: true,
    supportsThirdPartyPosting: true,
    partnerApprovalRequired: "none",
    rateLimitNotes: "Bot API is self-serve via BotFather; per-bot rate limits are generous for typical posting volume.",
    contentRestrictionNotes: "Posting is bot-to-channel, so it requires the channel to add the bot as admin — an operational step, not an API gate.",
  },
  discord: {
    platform: "discord",
    apiExists: true,
    supportsThirdPartyPosting: true,
    partnerApprovalRequired: "none",
    rateLimitNotes: "Self-serve bot/webhook API; per-route rate limits, generous for scheduled posting use cases.",
    contentRestrictionNotes: "Requires a server admin to add the bot/webhook — an operational step, not an approval gate.",
  },
  medium: {
    platform: "medium",
    apiExists: true,
    supportsThirdPartyPosting: true,
    partnerApprovalRequired: "unknown",
    rateLimitNotes: "Medium's publishing API has historically been limited/deprecated for new integrations; current third-party posting support is unclear.",
    contentRestrictionNotes: "Unassessed.",
  },
  vk: {
    platform: "vk",
    apiExists: true,
    supportsThirdPartyPosting: true,
    partnerApprovalRequired: "likely",
    rateLimitNotes: "VK API app review needed for elevated permissions/volume beyond basic per-method call limits.",
    contentRestrictionNotes: "Unassessed beyond standard VK platform policy.",
  },
  line: {
    platform: "line",
    apiExists: true,
    supportsThirdPartyPosting: true,
    partnerApprovalRequired: "likely",
    rateLimitNotes: "LINE Official Account Messaging API has monthly free-tier message caps; higher volume requires a paid plan, not necessarily partner approval.",
    contentRestrictionNotes: "Unassessed beyond standard LINE messaging policy.",
  },
  vimeo: {
    platform: "vimeo",
    apiExists: true,
    supportsThirdPartyPosting: true,
    partnerApprovalRequired: "likely",
    rateLimitNotes: "Production/unauthenticated app keys have low daily quota; an app review ('production access') request is needed for higher limits.",
    contentRestrictionNotes: "Unassessed beyond standard Vimeo content policy.",
  },
  flickr: {
    platform: "flickr",
    apiExists: true,
    supportsThirdPartyPosting: true,
    partnerApprovalRequired: "none",
    rateLimitNotes: "Self-serve API key; standard per-key rate limits.",
    contentRestrictionNotes: "Unassessed beyond standard Flickr community guidelines.",
  },
  foursquare: {
    platform: "foursquare",
    apiExists: true,
    supportsThirdPartyPosting: false,
    partnerApprovalRequired: "unknown",
    rateLimitNotes: "Foursquare's current public API surface is primarily Places/location data, not business-update posting.",
    contentRestrictionNotes: "Unassessed.",
  },
  bing: {
    platform: "bing",
    apiExists: true,
    supportsThirdPartyPosting: true,
    partnerApprovalRequired: "likely",
    rateLimitNotes: "Bing Places for Business API access for bulk/third-party listing management has historically required a partner/API-key request process.",
    contentRestrictionNotes: "Unassessed beyond standard listing-accuracy policy.",
  },
  applebusiness: {
    platform: "applebusiness",
    apiExists: true,
    supportsThirdPartyPosting: true,
    partnerApprovalRequired: "required",
    rateLimitNotes: "Apple Business Connect API access for managing other businesses' locations requires Apple's formal aggregator/partner approval.",
    contentRestrictionNotes: "Unassessed beyond standard location-data accuracy requirements.",
  },
  houzz: {
    platform: "houzz",
    apiExists: false,
    supportsThirdPartyPosting: false,
    partnerApprovalRequired: "required",
    rateLimitNotes: "No general self-serve public posting API known; any access is via case-by-case partner agreement.",
    contentRestrictionNotes: "Unassessed.",
  },
  angi: {
    platform: "angi",
    apiExists: false,
    supportsThirdPartyPosting: false,
    partnerApprovalRequired: "required",
    rateLimitNotes: "No general self-serve public posting API known; lead/listing integrations are typically bespoke partner deals.",
    contentRestrictionNotes: "Unassessed.",
  },
  thumbtack: {
    platform: "thumbtack",
    apiExists: false,
    supportsThirdPartyPosting: false,
    partnerApprovalRequired: "required",
    rateLimitNotes: "No general self-serve public posting API known.",
    contentRestrictionNotes: "Unassessed.",
  },
  tripadvisor: {
    platform: "tripadvisor",
    apiExists: true,
    supportsThirdPartyPosting: false,
    partnerApprovalRequired: "required",
    rateLimitNotes: "Tripadvisor's Content API is read/display-oriented (reviews, location data); there is no general write/posting API for unrelated third parties.",
    contentRestrictionNotes: "Unassessed.",
  },
  opentable: {
    platform: "opentable",
    apiExists: false,
    supportsThirdPartyPosting: false,
    partnerApprovalRequired: "required",
    rateLimitNotes: "No general self-serve public posting API known; integrations are restaurant-reservation-system partner deals.",
    contentRestrictionNotes: "Unassessed.",
  },
  quora: {
    platform: "quora",
    apiExists: false,
    supportsThirdPartyPosting: false,
    partnerApprovalRequired: "unknown",
    rateLimitNotes: "No general public posting API known.",
    contentRestrictionNotes: "Unassessed.",
  },
  trustpilot: {
    platform: "trustpilot",
    apiExists: true,
    supportsThirdPartyPosting: false,
    partnerApprovalRequired: "required",
    rateLimitNotes: "Business API (review invitations/replies) requires a Trustpilot Business subscription and API key approval, scoped to the business's own account, not arbitrary third parties.",
    contentRestrictionNotes: "Strict review-authenticity policy; no posting of promotional content as a 'review'.",
  },
  yandex: {
    platform: "yandex",
    apiExists: true,
    supportsThirdPartyPosting: true,
    partnerApprovalRequired: "likely",
    rateLimitNotes: "Yandex Business/Maps APIs have region-specific (Russia-focused) partner processes; access for non-Russian entities is uncertain.",
    contentRestrictionNotes: "Unassessed.",
  },
};

/** Looks up the partner-access risk for a platform, falling back to an
 * intentionally pessimistic "unassessed" default (apiExists: false,
 * partnerApprovalRequired: "unknown") for any platform without a real
 * adapter today — that default is a flag that nobody has checked, not an
 * assertion that the platform is unusable. */
export function statusOfPartnerAccess(platform: Platform): PartnerAccessRisk {
  return PARTNER_ACCESS_RISK[platform] ?? { platform, ...UNASSESSED_DEFAULT };
}
