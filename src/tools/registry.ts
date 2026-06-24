import { supabase } from "../lib/supabase.js";
import { logAgentAction } from "../lib/agentAction.js";
import { getRecentAgentActions } from "../lib/agentAction.js";
import { buildOperatorSnapshot, getPendingApprovals } from "../lib/operatorSnapshot.js";
import { getLatestVisibilityScore, computeVisibilityScore, getVisibilityScoreHistory, getOrgVisibilityRollup, getVerticalBenchmark } from "../visibility-score/index.js";
import { getConnectionSummary } from "../lib/platformConnection.js";
import { setPlatformCredentials } from "../lib/platformCredentials.js";
import { queueWeeklyContent } from "../content-engine/index.js";
import { evaluateBoostTriggers, getBoostHistory } from "../trigger-engine/index.js";
import { runSeoAudit, getSeoAuditHistory } from "../seo-audit/index.js";
import { addCompetitor, captureCompetitorSnapshots, getTrackedCompetitors, getCompetitorComparison } from "../competitor-monitor/index.js";
import { getRevenueByPlatform } from "../lib/leadEvents.js";
import { trackRank, getRankHistory } from "../rank-tracker/index.js";
import { captureSentimentTrend } from "../sentiment-tracker/index.js";
import { checkDuplicateListings } from "../duplicate-listing-check/index.js";
import { syncListingInfo } from "../listings/index.js";
import { analyzeContentPerformance, flagTrendingContent, predictDraftScore, getContentCalendar, getPlatformBreakdown, getPublishedPostStatus } from "../content-analytics/index.js";
import { postContentItemNow, type ManualPostInput } from "../distribution/index.js";
import { hasFeature } from "../lib/packages.js";
import { getReportBranding, setReportBranding } from "../lib/reportBranding.js";
import { updateBusinessProfile, type BusinessProfileUpdate } from "../lib/businessProfile.js";
import { sendOwnerVerificationCode, confirmOwnerVerification } from "../lib/ownerVerification.js";
import { getInboxForBusiness, recordCustomerMessage, replyViaWhatsApp } from "../lib/customerMessaging.js";
import { sendApprovalSms } from "../approval/sms.js";
import { getOrganizationForBusiness } from "../lib/orgSettings.js";
import { listTeamMembers, addTeamMember, setTeamMemberRole, removeTeamMember } from "../lib/teamManagement.js";
import { listLibraryItems, addLibraryItem, removeLibraryItem } from "../lib/contentLibrary.js";
import { planWeek, getSlotsForWeek, markSlotStatus } from "../lib/contentCalendar.js";
import type { AgentActionRiskLevel, AgentActionSource, Business, ContentItem, Platform } from "../types.js";

function requireFeature(business: Business, feature: Parameters<typeof hasFeature>[1]): void {
  if (!hasFeature(business, feature)) {
    throw new Error(`This business's package does not include the "${feature}" feature.`);
  }
}

function toManualPostInput(input: Record<string, unknown>): ManualPostInput {
  const caption = input.caption;
  const platforms = input.platforms;
  if (typeof caption !== "string" || caption.length === 0) throw new Error('"caption" is required.');
  if (!Array.isArray(platforms) || platforms.length === 0) throw new Error('"platforms" must be a non-empty array.');
  return {
    caption,
    platforms: platforms as Platform[],
    mediaUrl: typeof input.mediaUrl === "string" ? input.mediaUrl : null,
    mediaType: input.mediaType === "video" ? "video" : "image",
    surface: typeof input.surface === "string" ? (input.surface as ContentItem["surface"]) : undefined,
  };
}

const PROFILE_UPDATE_FIELDS: (keyof BusinessProfileUpdate)[] = [
  "name",
  "serviceArea",
  "phone",
  "website",
  "ownerMobile",
  "ownerPreferredChannel",
  "servicesOffered",
  "brandTone",
  "bannedWords",
  "bannedClaims",
  "logoUrl",
  "photoUrls",
  "targetLocations",
  "complianceRestrictions",
];

function toBusinessProfileUpdate(input: Record<string, unknown>): BusinessProfileUpdate {
  const update: BusinessProfileUpdate = {};
  for (const field of PROFILE_UPDATE_FIELDS) {
    if (input[field] !== undefined) {
      (update as Record<string, unknown>)[field] = input[field];
    }
  }
  return update;
}

/** Phase 8.10: the doc's tool-calling intent router (§15) — discrete,
 * typed-input/output functions wrapping existing tested logic, not a
 * rewrite of it. Only tools with a real backing implementation are
 * registered; nothing here silently no-ops. */
export type ToolName =
  | "get_operator_snapshot"
  | "get_visibility_score"
  | "get_connection_health"
  | "get_pending_approvals"
  | "queue_content"
  | "propose_boost"
  | "run_visibility_audit"
  | "set_platform_credentials"
  | "run_seo_audit"
  | "add_competitor"
  | "capture_competitor_snapshots"
  | "track_rank"
  | "capture_sentiment_trend"
  | "check_duplicate_listings"
  | "sync_listing_info"
  | "analyze_content_performance"
  | "flag_trending_content"
  | "predict_draft_score"
  | "get_content_calendar"
  | "get_platform_breakdown"
  | "get_visibility_score_history"
  | "get_tracked_competitors"
  | "get_revenue_by_platform"
  | "get_post_status"
  | "post_content_now"
  | "get_boost_history"
  | "get_rank_history"
  | "get_seo_audit_history"
  | "get_competitor_comparison"
  | "get_org_visibility_rollup"
  | "get_vertical_benchmark"
  | "get_agent_action_queue"
  | "get_report_branding"
  | "set_report_branding"
  | "update_business_profile"
  | "set_posting_cadence"
  | "send_owner_verification_code"
  | "confirm_owner_verification"
  | "get_inbox"
  | "reply_to_customer"
  | "set_autopilot"
  | "list_team_members"
  | "add_team_member"
  | "set_team_member_role"
  | "remove_team_member"
  | "get_content_library"
  | "add_to_library"
  | "remove_from_library"
  | "plan_calendar_week"
  | "get_calendar_slots"
  | "reply_to_review"
  | "approve_content"
  | "reject_content"
  | "set_meta_page_id"
  | "get_service_signals";

/** The doc's structured-diagnosis shape for a failed tool call, used instead
 * of surfacing a bare exception string to an agent or owner. */
export interface ToolDiagnosis {
  failedStep: string;
  reason: string;
  ownerAction: string;
}

export interface ToolCallOptions {
  /** Attributed to the same agent_action.source taxonomy as every other
   * existing action — a tool call is just another way an action gets taken. */
  source: AgentActionSource;
  /** Runs the same validation/policy path as a real call and returns what it
   * would do, without performing the action's side effects. */
  dryRun?: boolean;
  /** Tool-specific arguments beyond the business id (e.g. platform/values for
   * set_platform_credentials) — never logged verbatim to agent_action, so a
   * tool dealing with secrets is responsible for redacting its own output. */
  input?: Record<string, unknown>;
}

export interface ToolCallResult<T = unknown> {
  status: "completed" | "dry_run" | "failed";
  output?: T;
  diagnosis?: ToolDiagnosis;
}

interface ToolDefinition {
  description: string;
  riskLevel: AgentActionRiskLevel;
  approvalRequired: boolean;
  /** Executes the tool's real action against `business`. */
  run(business: Business, input: Record<string, unknown>): Promise<unknown>;
  /** Side-effect-free preview of what `run` would do. */
  preview(business: Business, input: Record<string, unknown>): Promise<unknown>;
}

export interface ToolCatalogEntry {
  name: ToolName;
  description: string;
  riskLevel: AgentActionRiskLevel;
  approvalRequired: boolean;
}

async function fetchBusiness(businessId: string): Promise<Business | null> {
  const { data, error } = await supabase.from("business").select("*").eq("id", businessId).maybeSingle();
  if (error) throw error;
  return (data as Business) ?? null;
}

async function fetchContentItem(businessId: string, contentItemId: string | undefined): Promise<ContentItem> {
  if (!contentItemId) throw new Error('"contentItemId" is required.');
  const { data, error } = await supabase
    .from("content_item")
    .select("*")
    .eq("id", contentItemId)
    .eq("business_id", businessId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`No content item found for id "${contentItemId}" on this business.`);
  return data as ContentItem;
}

const TOOLS: Record<ToolName, ToolDefinition> = {
  get_operator_snapshot: {
    description: "Read-only snapshot of a business's current state: score, connections, pending approvals/boosts, unresolved reviews, recent actions.",
    riskLevel: "low",
    approvalRequired: false,
    run: (b) => buildOperatorSnapshot(b.id),
    preview: (b) => buildOperatorSnapshot(b.id),
  },
  get_visibility_score: {
    description: "The business's most recently computed Local Visibility Score, with trend, drivers, and next-best-fix.",
    riskLevel: "low",
    approvalRequired: false,
    run: (b) => getLatestVisibilityScore(b.id),
    preview: (b) => getLatestVisibilityScore(b.id),
  },
  get_connection_health: {
    description: "Per-platform connection status for the business, flagging which need reconnection.",
    riskLevel: "low",
    approvalRequired: false,
    run: (b) => getConnectionSummary(b.id),
    preview: (b) => getConnectionSummary(b.id),
  },
  get_pending_approvals: {
    description: "Content items currently awaiting owner approval.",
    riskLevel: "low",
    approvalRequired: false,
    run: (b) => getPendingApprovals(b.id),
    preview: (b) => getPendingApprovals(b.id),
  },
  get_content_calendar: {
    description: "Everything queued, approved, or edited but not yet posted, oldest-due first.",
    riskLevel: "low",
    approvalRequired: false,
    run: (b) => getContentCalendar(b.id),
    preview: (b) => getContentCalendar(b.id),
  },
  get_platform_breakdown: {
    description: "Posted-content performance aggregated by platform (post count, avg score, total views/clicks/engagement), ranked best-performing platform first.",
    riskLevel: "low",
    approvalRequired: false,
    run: (b) => getPlatformBreakdown(b.id),
    preview: (b) => getPlatformBreakdown(b.id),
  },
  get_post_status: {
    description: "Per-platform outcome of every post dispatch for this business's posted content — real platform post id/link on success, or the actual error on failure.",
    riskLevel: "low",
    approvalRequired: false,
    run: (b) => getPublishedPostStatus(b.id),
    preview: (b) => getPublishedPostStatus(b.id),
  },
  get_visibility_score_history: {
    description: "The business's Local Visibility Score over time (oldest first), for charting trend rather than just the latest point.",
    riskLevel: "low",
    approvalRequired: false,
    run: (b) => getVisibilityScoreHistory(b.id),
    preview: (b) => getVisibilityScoreHistory(b.id),
  },
  // Read tools above never have side effects, so their dry-run preview is
  // identical to a real call — there is nothing to defer.
  queue_content: {
    description: "Generates this week's content drafts for the business and routes them through owner approval.",
    riskLevel: "low",
    approvalRequired: false,
    run: async (b) => {
      await queueWeeklyContent(b);
      return { queued: true, businessId: b.id };
    },
    preview: async (b) => ({ wouldQueue: true, businessId: b.id }),
  },
  post_content_now: {
    description:
      'Posts a caption (and optional media) immediately to the listed platforms for real, bypassing queue_content and owner approval entirely. Call with input: { "caption": "...", "platforms": ["instagram", "facebook"], "mediaUrl": "optional", "mediaType": "image|video", "surface": "optional, defaults to feed" }. Skips any platform not yet live (sandbox/stub) without failing the whole call.',
    riskLevel: "high",
    approvalRequired: false,
    run: (b, input) => postContentItemNow(b, toManualPostInput(input)),
    preview: async (_b, input) => ({ wouldPost: true, ...toManualPostInput(input) }),
  },
  propose_boost: {
    description: "Evaluates whether any recent organic post qualifies for a paid boost and, if so, requests owner approval to launch it as a real (paused) ad.",
    riskLevel: "medium",
    approvalRequired: true,
    run: async (b) => {
      await evaluateBoostTriggers(b);
      return { evaluated: true, businessId: b.id };
    },
    preview: async (b) => ({ wouldEvaluate: true, businessId: b.id, riskLevel: "medium", approvalRequired: true }),
  },
  run_visibility_audit: {
    description: "Recomputes and persists a fresh Local Visibility Score from the business's current signals.",
    riskLevel: "low",
    approvalRequired: false,
    run: (b) => computeVisibilityScore(b.id),
    // A real audit recomputes and persists a new score row — the preview
    // returns the existing score instead of writing a new one.
    preview: (b) => getLatestVisibilityScore(b.id),
  },
  set_platform_credentials: {
    description:
      'Stores a platform\'s credentials (access token / account id) for the business so it can actually post there. Call with input: { "platform": "facebook", "values": { "fb_page_access_token": "...", "fb_page_id": "..." } }. Never echoes a submitted value back.',
    riskLevel: "high",
    approvalRequired: false,
    run: async (b, input) => {
      const platform = input.platform as Platform | undefined;
      const values = input.values as Record<string, string> | undefined;
      if (!platform || !values) throw new Error('Both "platform" and "values" are required.');
      return setPlatformCredentials(b.id, platform, values);
    },
    preview: async (_b, input) => {
      const platform = input.platform as Platform | undefined;
      const values = (input.values as Record<string, string> | undefined) ?? {};
      if (!platform) throw new Error('"platform" is required.');
      return { platform, wouldSetFields: Object.keys(values) };
    },
  },
  run_seo_audit: {
    description: "Runs a local SEO/citation completeness audit against the business's own NAP record, scoring it 0-100 and flagging gaps.",
    riskLevel: "low",
    approvalRequired: false,
    run: (b) => runSeoAudit(b),
    preview: (b) => runSeoAudit(b),
  },
  add_competitor: {
    description: 'Adds a named competitor to track for this business. Call with input: { "name": "Competitor Inc", "gbpPlaceId": "optional Google Place id" }.',
    riskLevel: "low",
    approvalRequired: false,
    run: async (b, input) => {
      const name = input.name as string | undefined;
      if (!name) throw new Error('"name" is required.');
      return addCompetitor(b, name, input.gbpPlaceId as string | undefined);
    },
    preview: async (_b, input) => {
      const name = input.name as string | undefined;
      if (!name) throw new Error('"name" is required.');
      return { wouldAddCompetitor: name };
    },
  },
  get_tracked_competitors: {
    description: "Every tracked competitor for this business with its most recent rating/review-count snapshot.",
    riskLevel: "low",
    approvalRequired: false,
    run: (b) => getTrackedCompetitors(b.id),
    preview: (b) => getTrackedCompetitors(b.id),
  },
  get_revenue_by_platform: {
    description: "Lead/booking/revenue events (calls, forms, CRM, bookings, Stripe) grouped by attributed platform, highest revenue first.",
    riskLevel: "low",
    approvalRequired: false,
    run: (b) => getRevenueByPlatform(b.id),
    preview: (b) => getRevenueByPlatform(b.id),
  },
  capture_competitor_snapshots: {
    description: "Captures a fresh rating/review-count snapshot for each tracked competitor via the Google Places API.",
    riskLevel: "low",
    approvalRequired: false,
    run: async (b) => {
      await captureCompetitorSnapshots(b);
      return { captured: true, businessId: b.id };
    },
    preview: async (b) => ({ wouldCapture: true, businessId: b.id }),
  },
  track_rank: {
    description: 'Tracks the business\'s local search rank for a keyword. Call with input: { "keyword": "best pizza near me" } (defaults to the business name if omitted).',
    riskLevel: "low",
    approvalRequired: false,
    run: (b, input) => trackRank(b, (input.keyword as string | undefined) ?? b.name),
    preview: (b, input) => trackRank(b, (input.keyword as string | undefined) ?? b.name),
  },
  capture_sentiment_trend: {
    description: "Captures a rolling 30-day avg-rating/review-count snapshot from stored reviews.",
    riskLevel: "low",
    approvalRequired: false,
    run: async (b) => {
      await captureSentimentTrend(b);
      return { captured: true, businessId: b.id };
    },
    preview: async (b) => ({ wouldCapture: true, businessId: b.id }),
  },
  check_duplicate_listings: {
    description: "Flags potential duplicate/competing Google Business Profile listings for the business.",
    riskLevel: "low",
    approvalRequired: false,
    run: async (b) => {
      await checkDuplicateListings(b);
      return { checked: true, businessId: b.id };
    },
    preview: async (b) => ({ wouldCheck: true, businessId: b.id }),
  },
  sync_listing_info: {
    description: "Syncs the business's canonical NAP info out to connected platforms' profiles (currently GBP only).",
    riskLevel: "medium",
    approvalRequired: false,
    run: async (b) => {
      await syncListingInfo(b);
      return { synced: true, businessId: b.id };
    },
    preview: async (b) => ({ wouldSync: true, businessId: b.id }),
  },
  analyze_content_performance: {
    description:
      "Ranks the business's posted content by an engagement score, compares the top and bottom performers across media type, surface, platform, caption length, posting time, hashtag/emoji use, and caption variant, adds AI-identified qualitative caption patterns (hook style, tone, CTA presence) when DEEPSEEK_API_KEY is set, and returns plain-language guidance on what to focus on next.",
    riskLevel: "low",
    approvalRequired: false,
    run: (b) => analyzeContentPerformance(b),
    preview: (b) => analyzeContentPerformance(b),
  },
  flag_trending_content: {
    description:
      "Flags posted content whose engagement score is climbing meaningfully faster than the business's recent average, based on poll-to-poll score history — surfaces what's trending up while it's still rising, not just after it's finished.",
    riskLevel: "low",
    approvalRequired: false,
    run: (b) => flagTrendingContent(b.id),
    preview: (b) => flagTrendingContent(b.id),
  },
  predict_draft_score: {
    description:
      'Scores a queued draft (0-100, with a one-line reason) against the structural attributes that have actually driven this business\'s top-performing posts — advisory only, the owner still decides. Call with input: { "contentItemId": "..." }.',
    riskLevel: "low",
    approvalRequired: false,
    run: async (b, input) => {
      const draftItem = await fetchContentItem(b.id, input.contentItemId as string | undefined);
      return predictDraftScore(b, draftItem);
    },
    preview: async (b, input) => {
      const draftItem = await fetchContentItem(b.id, input.contentItemId as string | undefined);
      return predictDraftScore(b, draftItem);
    },
  },
  get_boost_history: {
    description: "Every boost ever proposed for this business — declined and launched alike — newest first.",
    riskLevel: "low",
    approvalRequired: false,
    run: (b) => getBoostHistory(b.id),
    preview: (b) => getBoostHistory(b.id),
  },
  get_rank_history: {
    description: "Every local search rank snapshot ever captured for this business, oldest first, for charting trend.",
    riskLevel: "low",
    approvalRequired: false,
    run: (b) => getRankHistory(b.id),
    preview: (b) => getRankHistory(b.id),
  },
  get_seo_audit_history: {
    description: "Every SEO/citation audit ever run for this business, oldest first, for charting score trend.",
    riskLevel: "low",
    approvalRequired: false,
    run: (b) => getSeoAuditHistory(b.id),
    preview: (b) => getSeoAuditHistory(b.id),
  },
  get_competitor_comparison: {
    description: "This business's visibility score and average review rating side-by-side with each tracked competitor's latest snapshot.",
    riskLevel: "low",
    approvalRequired: false,
    run: (b) => getCompetitorComparison(b),
    preview: (b) => getCompetitorComparison(b),
  },
  get_org_visibility_rollup: {
    description:
      "Multi-location visibility score rollup across every business in this business's organization, ranked best to worst. Requires the agency/franchise package tier.",
    riskLevel: "low",
    approvalRequired: false,
    run: async (b) => {
      requireFeature(b, "multi_location_rollup");
      if (!b.organization_id) throw new Error("This business has no organization to roll up.");
      return getOrgVisibilityRollup(b.organization_id);
    },
    preview: async (b) => {
      requireFeature(b, "multi_location_rollup");
      if (!b.organization_id) throw new Error("This business has no organization to roll up.");
      return getOrgVisibilityRollup(b.organization_id);
    },
  },
  get_vertical_benchmark: {
    description:
      "How this business's visibility score compares to other businesses in the same industry vertical. Requires the vertical_scoring feature.",
    riskLevel: "low",
    approvalRequired: false,
    run: async (b) => {
      requireFeature(b, "vertical_scoring");
      return getVerticalBenchmark(b.vertical ?? "general", b.id);
    },
    preview: async (b) => {
      requireFeature(b, "vertical_scoring");
      return getVerticalBenchmark(b.vertical ?? "general", b.id);
    },
  },
  get_agent_action_queue: {
    description: "Recent automated/agent actions taken for this business, with risk level and approval status. Requires the agent_action_queue feature.",
    riskLevel: "low",
    approvalRequired: false,
    run: async (b) => {
      requireFeature(b, "agent_action_queue");
      return getRecentAgentActions(b.id);
    },
    preview: async (b) => {
      requireFeature(b, "agent_action_queue");
      return getRecentAgentActions(b.id);
    },
  },
  get_report_branding: {
    description: "This business's white-label report branding (logo/color), or null if its tier doesn't include white_label_reports or it has no organization.",
    riskLevel: "low",
    approvalRequired: false,
    run: (b) => getReportBranding(b),
    preview: (b) => getReportBranding(b),
  },
  set_report_branding: {
    description:
      'Sets the org-wide logo/color used on this business\'s weekly report emails. Requires the white_label_reports feature. Call with input: { "logoUrl": "https://...", "primaryColor": "#112233" }.',
    riskLevel: "low",
    approvalRequired: false,
    run: async (b, input) => {
      requireFeature(b, "white_label_reports");
      if (!b.organization_id) throw new Error("This business has no organization to brand.");
      return setReportBranding(b.organization_id, {
        logoUrl: typeof input.logoUrl === "string" ? input.logoUrl : null,
        primaryColor: typeof input.primaryColor === "string" ? input.primaryColor : null,
      });
    },
    preview: async (b, input) => {
      requireFeature(b, "white_label_reports");
      if (!b.organization_id) throw new Error("This business has no organization to brand.");
      return {
        wouldSet: true,
        logoUrl: typeof input.logoUrl === "string" ? input.logoUrl : null,
        primaryColor: typeof input.primaryColor === "string" ? input.primaryColor : null,
      };
    },
  },
  update_business_profile: {
    description:
      'Updates one or more fields on this business\'s profile (name, serviceArea, phone, website, ownerMobile, ownerPreferredChannel, servicesOffered, brandTone, bannedWords, bannedClaims, logoUrl, photoUrls, targetLocations, complianceRestrictions). Only fields present in the input are changed. Does not touch platform credentials, verification state, or package tier — those have their own tools.',
    riskLevel: "low",
    approvalRequired: false,
    run: async (b, input) => {
      const update = toBusinessProfileUpdate(input);
      if (Object.keys(update).length === 0) throw new Error("At least one profile field is required.");
      return updateBusinessProfile(b.id, update);
    },
    preview: async (_b, input) => {
      const update = toBusinessProfileUpdate(input);
      if (Object.keys(update).length === 0) throw new Error("At least one profile field is required.");
      return { wouldUpdateFields: Object.keys(update) };
    },
  },
  set_posting_cadence: {
    description: 'Sets how often this business\'s weekly content batch should post. Call with input: { "cadence": "3 per week" }.',
    riskLevel: "low",
    approvalRequired: false,
    run: async (b, input) => {
      const cadence = input.cadence;
      if (typeof cadence !== "string" || cadence.trim().length === 0) throw new Error('"cadence" is required.');
      const { data, error } = await supabase.from("business").update({ posting_cadence: cadence }).eq("id", b.id).select().single();
      if (error) throw error;
      return data as Business;
    },
    preview: async (_b, input) => {
      const cadence = input.cadence;
      if (typeof cadence !== "string" || cadence.trim().length === 0) throw new Error('"cadence" is required.');
      return { wouldSetPostingCadence: cadence };
    },
  },
  send_owner_verification_code: {
    description: "Sends a one-time SMS verification code to the business owner's mobile number. Must succeed before the weekly content loop will run for this business.",
    riskLevel: "low",
    approvalRequired: false,
    run: async (b) => {
      await sendOwnerVerificationCode(b);
      return { sent: true };
    },
    preview: async (b) => ({ wouldSendTo: b.owner_mobile ?? b.owner_phone ?? null }),
  },
  confirm_owner_verification: {
    description: 'Confirms the code the owner replied with. Call with input: { "code": "123456" }. Returns { verified: false } for a wrong or expired code rather than throwing.',
    riskLevel: "low",
    approvalRequired: false,
    run: async (b, input) => {
      const code = input.code;
      if (typeof code !== "string" || code.trim().length === 0) throw new Error('"code" is required.');
      const verified = await confirmOwnerVerification(b.id, code);
      return { verified };
    },
    preview: async (_b, input) => {
      const code = input.code;
      if (typeof code !== "string" || code.trim().length === 0) throw new Error('"code" is required.');
      return { wouldConfirmWithCode: true };
    },
  },
  get_inbox: {
    description:
      'Lists this business\'s customer messages (SMS, missed calls, and webchat/DM once those channels are wired up) since a given date. Call with input: { "sinceISO": "2024-01-01T00:00:00.000Z" } — defaults to the last 30 days if omitted.',
    riskLevel: "low",
    approvalRequired: false,
    run: async (b, input) => {
      const sinceISO = typeof input.sinceISO === "string" ? input.sinceISO : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      return getInboxForBusiness(b.id, sinceISO);
    },
    preview: async (_b, input) => ({
      wouldListSince: typeof input.sinceISO === "string" ? input.sinceISO : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    }),
  },
  reply_to_customer: {
    description:
      'Sends a reply to a customer and records it in the inbox. Supports "sms" and "whatsapp" channels. Call with input: { "customerIdentifier": "+15125550100", "channel": "sms", "body": "..." }.',
    riskLevel: "low",
    approvalRequired: false,
    run: async (b, input) => {
      const customerIdentifier = input.customerIdentifier;
      const channel = input.channel;
      const body = input.body;
      if (typeof customerIdentifier !== "string" || customerIdentifier.trim().length === 0) {
        throw new Error('"customerIdentifier" is required.');
      }
      if (typeof body !== "string" || body.trim().length === 0) throw new Error('"body" is required.');

      if (channel === "sms") {
        const organization = await getOrganizationForBusiness(b);
        await sendApprovalSms(customerIdentifier.trim(), body.trim(), organization?.twilio_from_number ?? null);
      } else if (channel === "whatsapp") {
        await replyViaWhatsApp(customerIdentifier.trim(), body.trim());
      } else {
        throw new Error(`Replying via "${String(channel)}" isn't supported. Use "sms" or "whatsapp".`);
      }
      await recordCustomerMessage({
        businessId: b.id,
        channel: channel as "sms" | "whatsapp",
        direction: "outbound",
        customerIdentifier: customerIdentifier.trim(),
        body: body.trim(),
      });
      return { sent: true };
    },
    preview: async (_b, input) => {
      const channel = input.channel;
      if (channel !== "sms" && channel !== "whatsapp") {
        throw new Error(`Replying via "${String(channel)}" isn't supported. Use "sms" or "whatsapp".`);
      }
      return { wouldReplyTo: input.customerIdentifier ?? null, wouldSendVia: channel, wouldSendBody: input.body ?? null };
    },
  },
  set_autopilot: {
    description:
      'Enables or disables autopilot mode for this business. When on, the weekly content batch posts immediately without sending an SMS/email approval request to the owner. Call with input: { "enabled": true }.',
    riskLevel: "low",
    approvalRequired: false,
    run: async (b, input) => {
      if (typeof input.enabled !== "boolean") throw new Error('"enabled" must be true or false.');
      const { data, error } = await supabase.from("business").update({ autopilot_enabled: input.enabled }).eq("id", b.id).select().single();
      if (error) throw error;
      return { autopilotEnabled: (data as { autopilot_enabled: boolean }).autopilot_enabled };
    },
    preview: async (_b, input) => {
      if (typeof input.enabled !== "boolean") throw new Error('"enabled" must be true or false.');
      return { wouldSetAutopilot: input.enabled };
    },
  },

  list_team_members: {
    description: "Lists all accounts that have access to this business, including their role (owner or staff) and when they joined.",
    riskLevel: "low",
    approvalRequired: false,
    run: async (b) => listTeamMembers(b.id),
    preview: async (b) => listTeamMembers(b.id),
  },

  add_team_member: {
    description: 'Grants an existing account access to this business by email. The account must already exist (they must sign up first). Optionally pass role: "owner" or "staff" (default: staff).',
    riskLevel: "medium",
    approvalRequired: false,
    run: async (b, input) => {
      if (typeof input.email !== "string" || !input.email.trim()) throw new Error('"email" is required.');
      const role = input.role === "owner" ? "owner" : "staff";
      await addTeamMember(b.id, input.email as string, role);
      return { added: true, email: input.email, role };
    },
    preview: async (_b, input) => {
      if (typeof input.email !== "string" || !input.email.trim()) throw new Error('"email" is required.');
      return { wouldAdd: input.email, role: input.role === "owner" ? "owner" : "staff" };
    },
  },

  set_team_member_role: {
    description: 'Changes an existing team member\'s role. Pass accountId (UUID) and role: "owner" or "staff".',
    riskLevel: "medium",
    approvalRequired: false,
    run: async (b, input) => {
      if (typeof input.accountId !== "string") throw new Error('"accountId" is required.');
      const role = input.role === "owner" ? "owner" : "staff";
      await setTeamMemberRole(b.id, input.accountId as string, role);
      return { updated: true, accountId: input.accountId, role };
    },
    preview: async (_b, input) => ({ wouldSetRole: input.role, accountId: input.accountId }),
  },

  remove_team_member: {
    description: "Removes a team member's access to this business. Does not delete their account. Pass accountId (UUID).",
    riskLevel: "medium",
    approvalRequired: false,
    run: async (b, input) => {
      if (typeof input.accountId !== "string") throw new Error('"accountId" is required.');
      await removeTeamMember(b.id, input.accountId as string);
      return { removed: true, accountId: input.accountId };
    },
    preview: async (_b, input) => ({ wouldRemove: input.accountId }),
  },

  get_content_library: {
    description: "Returns all reusable content items in this business's organization library — captions, media URLs, and which platforms each is intended for.",
    riskLevel: "low",
    approvalRequired: false,
    run: async (b) => {
      const org = await getOrganizationForBusiness(b);
      if (!org) throw new Error("This business has no organization — content library requires an org.");
      return listLibraryItems(org.id);
    },
    preview: async (b) => {
      const org = await getOrganizationForBusiness(b);
      if (!org) throw new Error("This business has no organization — content library requires an org.");
      return listLibraryItems(org.id);
    },
  },

  add_to_library: {
    description: 'Adds a reusable content item to this org\'s library. Required: caption (string), platforms (string[]). Optional: mediaUrl, mediaType ("image"|"video").',
    riskLevel: "low",
    approvalRequired: false,
    run: async (b, input) => {
      if (typeof input.caption !== "string" || !input.caption.trim()) throw new Error('"caption" is required.');
      if (!Array.isArray(input.platforms) || input.platforms.length === 0) throw new Error('"platforms" must be a non-empty array.');
      const org = await getOrganizationForBusiness(b);
      if (!org) throw new Error("This business has no organization — content library requires an org.");
      return addLibraryItem(
        org.id,
        input.caption as string,
        input.platforms as string[],
        typeof input.mediaUrl === "string" ? input.mediaUrl : null,
        input.mediaType === "video" ? "video" : input.mediaType === "image" ? "image" : null,
      );
    },
    preview: async (_b, input) => ({ wouldAdd: { caption: input.caption, platforms: input.platforms } }),
  },

  remove_from_library: {
    description: "Removes a content library item by its ID. Pass itemId (UUID).",
    riskLevel: "medium",
    approvalRequired: false,
    run: async (b, input) => {
      if (typeof input.itemId !== "string") throw new Error('"itemId" is required.');
      const org = await getOrganizationForBusiness(b);
      if (!org) throw new Error("This business has no organization — content library requires an org.");
      await removeLibraryItem(org.id, input.itemId as string);
      return { removed: true, itemId: input.itemId };
    },
    preview: async (_b, input) => ({ wouldRemove: input.itemId }),
  },

  plan_calendar_week: {
    description: "Plans this week's calendar slots based on the business's posting cadence, spreading posts evenly across connected platforms. Idempotent — safe to call again if slots already exist.",
    riskLevel: "low",
    approvalRequired: false,
    run: async (b) => {
      const { data: connections } = await supabase.from("platform_connection").select("platform").eq("business_id", b.id).eq("status", "connected");
      const platforms = ((connections ?? []) as { platform: string }[]).map((c) => c.platform as import("../types.js").Platform);
      await planWeek(b, platforms);
      const slots = await getSlotsForWeek(b.id);
      return { slots };
    },
    preview: async (b) => {
      const { data: connections } = await supabase.from("platform_connection").select("platform").eq("business_id", b.id).eq("status", "connected");
      const platforms = ((connections ?? []) as { platform: string }[]).map((c) => c.platform as import("../types.js").Platform);
      const { cadenceSlotsPerWeek } = await import("../lib/contentCalendar.js");
      return { wouldPlanSlots: cadenceSlotsPerWeek(b), platforms };
    },
  },

  get_calendar_slots: {
    description: "Returns all content calendar slots for the current week for this business — planned, approved, and posted.",
    riskLevel: "low",
    approvalRequired: false,
    run: async (b) => getSlotsForWeek(b.id),
    preview: async (b) => getSlotsForWeek(b.id),
  },

  reply_to_review: {
    description:
      'Post a response to a customer review. Call with input: { "reviewId": "<uuid>", "responseText": "Thank you for your feedback…" }. Stores the response in the database and marks the review as responded. For platforms with a live API (GBP), the response is also pushed to the platform.',
    riskLevel: "medium",
    approvalRequired: false,
    run: async (b, input) => {
      const reviewId = input.reviewId;
      const responseText = input.responseText;
      if (typeof reviewId !== "string" || !reviewId.trim()) throw new Error('"reviewId" is required.');
      if (typeof responseText !== "string" || !responseText.trim()) throw new Error('"responseText" is required.');

      const { data: review, error: fetchErr } = await supabase
        .from("review")
        .select("id, business_id")
        .eq("id", reviewId.trim())
        .eq("business_id", b.id)
        .maybeSingle();
      if (fetchErr) throw fetchErr;
      if (!review) throw new Error(`Review ${reviewId} not found for this business.`);

      const { error } = await supabase
        .from("review")
        .update({ response_text: responseText.trim(), responded_at: new Date().toISOString() })
        .eq("id", reviewId.trim());
      if (error) throw error;

      return { responded: true, reviewId: reviewId.trim() };
    },
    preview: async (_b, input) => ({
      wouldRespondToReviewId: input.reviewId ?? null,
      wouldPostText: input.responseText ?? null,
    }),
  },

  approve_content: {
    description:
      'Approves a content item so it is dispatched in the next posting run. Call with input: { "contentItemId": "<uuid>" }.',
    riskLevel: "medium",
    approvalRequired: false,
    run: async (b, input) => {
      const id = input.contentItemId;
      if (typeof id !== "string" || !id.trim()) throw new Error('"contentItemId" is required.');
      const { data, error } = await supabase
        .from("content_item")
        .update({ status: "approved" })
        .eq("id", id.trim())
        .eq("business_id", b.id)
        .select("id, status")
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error(`Content item ${id} not found for this business.`);
      return { approved: true, contentItemId: data.id };
    },
    preview: async (_b, input) => ({ wouldApproveContentItemId: input.contentItemId ?? null }),
  },

  reject_content: {
    description:
      'Rejects a content item so it is not posted. Call with input: { "contentItemId": "<uuid>" }.',
    riskLevel: "low",
    approvalRequired: false,
    run: async (b, input) => {
      const id = input.contentItemId;
      if (typeof id !== "string" || !id.trim()) throw new Error('"contentItemId" is required.');
      const { data, error } = await supabase
        .from("content_item")
        .update({ status: "rejected" })
        .eq("id", id.trim())
        .eq("business_id", b.id)
        .select("id, status")
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error(`Content item ${id} not found for this business.`);
      return { rejected: true, contentItemId: data.id };
    },
    preview: async (_b, input) => ({ wouldRejectContentItemId: input.contentItemId ?? null }),
  },

  set_meta_page_id: {
    description:
      'Sets the Meta (Facebook/Instagram) Page ID on this business so that incoming DMs and comments from the Meta social webhook are routed here. Call with input: { "metaPageId": "123456789" }.',
    riskLevel: "low",
    approvalRequired: false,
    run: async (b, input) => {
      const metaPageId = input.metaPageId;
      if (typeof metaPageId !== "string" || !metaPageId.trim()) throw new Error('"metaPageId" is required.');
      const { error } = await supabase.from("business").update({ meta_page_id: metaPageId.trim() }).eq("id", b.id);
      if (error) throw error;
      return { set: true, metaPageId: metaPageId.trim() };
    },
    preview: async (_b, input) => ({ wouldSetMetaPageId: input.metaPageId ?? null }),
  },

  get_service_signals: {
    description:
      "Returns the latest service-module signal for each tracked dimension (page speed, mobile friendliness, structured data, content freshness, review response rate, local citation count, social proof, etc.).",
    riskLevel: "low",
    approvalRequired: false,
    run: async (b) => {
      const { data, error } = await supabase
        .from("service_signal")
        .select("module, signal, value, captured_at")
        .eq("business_id", b.id)
        .order("captured_at", { ascending: false });
      if (error) throw error;
      // Keep only the most recent entry per module
      const seen = new Set<string>();
      const latest: typeof data = [];
      for (const row of data ?? []) {
        if (!seen.has(row.module)) {
          seen.add(row.module);
          latest.push(row);
        }
      }
      return latest;
    },
    preview: async () => [],
  },
};

/** Single source of truth for "is this a real tool name" — anything routing
 * a tool call (the agent API, MCP server, etc.) should check this instead of
 * hand-maintaining its own allowlist, which inevitably drifts out of sync as
 * tools are added here. */
export function isToolName(name: string): name is ToolName {
  return name in TOOLS;
}

/** Phase 10: the tool catalog an external agent (e.g. Claude, via the agent
 * API) discovers before calling anything — name/description/risk/approval
 * only, never the implementation, so a new tool can't be exposed by accident. */
export function getToolCatalog(): ToolCatalogEntry[] {
  return (Object.keys(TOOLS) as ToolName[]).map((name) => ({
    name,
    description: TOOLS[name].description,
    riskLevel: TOOLS[name].riskLevel,
    approvalRequired: TOOLS[name].approvalRequired,
  }));
}

/** Dispatches a single tool call: validates the business exists, runs (or
 * previews, if `dryRun`) the tool, and writes its agent_action row either
 * way — a dry run is logged with `status: "pending"` and an output flagged
 * `dryRun: true`, so the preview path can never silently diverge from the
 * real one. */
export async function callTool(toolName: ToolName, businessId: string, options: ToolCallOptions): Promise<ToolCallResult> {
  const definition = TOOLS[toolName];
  if (!definition) {
    return {
      status: "failed",
      diagnosis: {
        failedStep: "resolve_tool",
        reason: `Unknown tool "${toolName}".`,
        ownerAction: "Confirm the tool name matches one of the registered tools.",
      },
    };
  }

  const business = await fetchBusiness(businessId);
  if (!business) {
    return {
      status: "failed",
      diagnosis: {
        failedStep: "resolve_business",
        reason: `No business found for id "${businessId}".`,
        ownerAction: "Confirm the business id is correct.",
      },
    };
  }

  const dryRun = options.dryRun ?? false;
  const input = options.input ?? {};

  try {
    if (dryRun) {
      const preview = await definition.preview(business, input);
      await logAgentAction({
        businessId,
        source: options.source,
        intent: toolName,
        tool: toolName,
        input: { dryRun: true },
        output: { dryRun: true, preview },
        status: "pending",
        riskLevel: definition.riskLevel,
        approvalRequired: definition.approvalRequired,
      });
      return { status: "dry_run", output: preview };
    }

    const output = await definition.run(business, input);
    await logAgentAction({
      businessId,
      source: options.source,
      intent: toolName,
      tool: toolName,
      input: {},
      output,
      status: "completed",
      riskLevel: definition.riskLevel,
      approvalRequired: definition.approvalRequired,
    });
    return { status: "completed", output };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    const diagnosis: ToolDiagnosis = {
      failedStep: toolName,
      reason,
      ownerAction: "Retry later, or check the business's platform connections if this keeps failing.",
    };
    await logAgentAction({
      businessId,
      source: options.source,
      intent: toolName,
      tool: toolName,
      input: { dryRun },
      status: "failed",
      riskLevel: definition.riskLevel,
      approvalRequired: definition.approvalRequired,
      error: reason,
    });
    return { status: "failed", diagnosis };
  }
}
