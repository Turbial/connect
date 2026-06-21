import { supabase } from "./supabase.js";
import type { AgentAction, AgentActionRiskLevel, AgentActionSource, AgentActionStatus } from "../types.js";

export interface LogAgentActionInput {
  businessId: string;
  source: AgentActionSource;
  intent: string;
  tool: string;
  input: unknown;
  output?: unknown | null;
  status: AgentActionStatus;
  riskLevel: AgentActionRiskLevel;
  approvalRequired: boolean;
  ownerResponse?: string | null;
  platformResult?: unknown | null;
  error?: string | null;
}

/** Phase 8.9 (doc §15): writes one row to the unified agent action queue.
 * This phase is a parallel audit trail only — callers still execute their
 * existing logic directly; this just records what happened, it doesn't
 * gate or drive it. retry_count starts at 0 and audit_log starts as a
 * single entry recording the initial status, since there's no retry loop
 * reading this table yet. */
export async function logAgentAction(record: LogAgentActionInput): Promise<AgentAction> {
  const { data, error } = await supabase
    .from("agent_action")
    .insert({
      business_id: record.businessId,
      source: record.source,
      intent: record.intent,
      tool: record.tool,
      input: record.input,
      output: record.output ?? null,
      status: record.status,
      risk_level: record.riskLevel,
      approval_required: record.approvalRequired,
      owner_response: record.ownerResponse ?? null,
      platform_result: record.platformResult ?? null,
      error: record.error ?? null,
      retry_count: 0,
      audit_log: [`${record.status} at ${new Date().toISOString()}`],
    })
    .select()
    .single();
  if (error) throw error;
  return data as AgentAction;
}

/** Recent agent_action rows for a business, newest first — used by the
 * operator snapshot (Phase 8.9) so an agent can see what's already
 * happened without a separate query. */
export async function getRecentAgentActions(businessId: string, limit = 20): Promise<AgentAction[]> {
  const { data, error } = await supabase
    .from("agent_action")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as AgentAction[];
}
