import { supabase } from "../lib/supabase.js";
import { logAgentAction } from "../lib/agentAction.js";
import { buildOperatorSnapshot, getPendingApprovals } from "../lib/operatorSnapshot.js";
import { getLatestVisibilityScore, computeVisibilityScore } from "../visibility-score/index.js";
import { getConnectionSummary } from "../lib/platformConnection.js";
import { queueWeeklyContent } from "../content-engine/index.js";
import { evaluateBoostTriggers } from "../trigger-engine/index.js";
import type { AgentActionRiskLevel, AgentActionSource, Business } from "../types.js";

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
  | "run_visibility_audit";

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
}

export interface ToolCallResult<T = unknown> {
  status: "completed" | "dry_run" | "failed";
  output?: T;
  diagnosis?: ToolDiagnosis;
}

interface ToolDefinition {
  riskLevel: AgentActionRiskLevel;
  approvalRequired: boolean;
  /** Executes the tool's real action against `business`. */
  run(business: Business): Promise<unknown>;
  /** Side-effect-free preview of what `run` would do. */
  preview(business: Business): Promise<unknown>;
}

async function fetchBusiness(businessId: string): Promise<Business | null> {
  const { data, error } = await supabase.from("business").select("*").eq("id", businessId).maybeSingle();
  if (error) throw error;
  return (data as Business) ?? null;
}

const TOOLS: Record<ToolName, ToolDefinition> = {
  get_operator_snapshot: {
    riskLevel: "low",
    approvalRequired: false,
    run: (b) => buildOperatorSnapshot(b.id),
    preview: (b) => buildOperatorSnapshot(b.id),
  },
  get_visibility_score: {
    riskLevel: "low",
    approvalRequired: false,
    run: (b) => getLatestVisibilityScore(b.id),
    preview: (b) => getLatestVisibilityScore(b.id),
  },
  get_connection_health: {
    riskLevel: "low",
    approvalRequired: false,
    run: (b) => getConnectionSummary(b.id),
    preview: (b) => getConnectionSummary(b.id),
  },
  get_pending_approvals: {
    riskLevel: "low",
    approvalRequired: false,
    run: (b) => getPendingApprovals(b.id),
    preview: (b) => getPendingApprovals(b.id),
  },
  // Read tools above never have side effects, so their dry-run preview is
  // identical to a real call — there is nothing to defer.
  queue_content: {
    riskLevel: "low",
    approvalRequired: false,
    run: async (b) => {
      await queueWeeklyContent(b);
      return { queued: true, businessId: b.id };
    },
    preview: async (b) => ({ wouldQueue: true, businessId: b.id }),
  },
  propose_boost: {
    riskLevel: "medium",
    approvalRequired: true,
    run: async (b) => {
      await evaluateBoostTriggers(b);
      return { evaluated: true, businessId: b.id };
    },
    preview: async (b) => ({ wouldEvaluate: true, businessId: b.id, riskLevel: "medium", approvalRequired: true }),
  },
  run_visibility_audit: {
    riskLevel: "low",
    approvalRequired: false,
    run: (b) => computeVisibilityScore(b.id),
    // A real audit recomputes and persists a new score row — the preview
    // returns the existing score instead of writing a new one.
    preview: (b) => getLatestVisibilityScore(b.id),
  },
};

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

  try {
    if (dryRun) {
      const preview = await definition.preview(business);
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

    const output = await definition.run(business);
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
