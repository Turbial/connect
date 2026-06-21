import { supabase } from "../lib/supabase.js";
import { logAgentAction } from "../lib/agentAction.js";
import { buildOperatorSnapshot, getPendingApprovals } from "../lib/operatorSnapshot.js";
import { getLatestVisibilityScore, computeVisibilityScore, getVisibilityScoreHistory } from "../visibility-score/index.js";
import { getConnectionSummary } from "../lib/platformConnection.js";
import { setPlatformCredentials } from "../lib/platformCredentials.js";
import { queueWeeklyContent } from "../content-engine/index.js";
import { evaluateBoostTriggers } from "../trigger-engine/index.js";
import { runSeoAudit } from "../seo-audit/index.js";
import { addCompetitor, captureCompetitorSnapshots, getTrackedCompetitors } from "../competitor-monitor/index.js";
import { getRevenueByPlatform } from "../lib/leadEvents.js";
import { trackRank } from "../rank-tracker/index.js";
import { captureSentimentTrend } from "../sentiment-tracker/index.js";
import { checkDuplicateListings } from "../duplicate-listing-check/index.js";
import { syncListingInfo } from "../listings/index.js";
import { analyzeContentPerformance, flagTrendingContent, predictDraftScore, getContentCalendar, getPlatformBreakdown, getPublishedPostStatus } from "../content-analytics/index.js";
import type { AgentActionRiskLevel, AgentActionSource, Business, ContentItem, Platform } from "../types.js";

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
  | "get_post_status";

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
