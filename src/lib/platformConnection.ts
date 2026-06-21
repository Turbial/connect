import { supabase } from "./supabase.js";
import type { Platform, PlatformConnection } from "../types.js";

/** Superset of PlatformStatus (src/lib/platformStatus.ts) for connection-level
 * lifecycle states that don't apply to the static platform taxonomy. */
export type ConnectionStatus =
  | "verified"
  | "sandbox"
  | "partner_gated"
  | "stub"
  | "unsupported"
  | "expiring"
  | "expired"
  | "failed"
  | "missing_permissions"
  | "failed_refresh";

export async function getConnection(businessId: string, platform: Platform): Promise<PlatformConnection | null> {
  const { data, error } = await supabase
    .from("platform_connection")
    .select("*")
    .eq("business_id", businessId)
    .eq("platform", platform)
    .maybeSingle();
  if (error) throw error;
  return (data as PlatformConnection | null) ?? null;
}

export async function getConnectionsForBusiness(businessId: string): Promise<PlatformConnection[]> {
  const { data, error } = await supabase
    .from("platform_connection")
    .select("*")
    .eq("business_id", businessId);
  if (error) throw error;
  return (data ?? []) as PlatformConnection[];
}

export async function isConnected(businessId: string, platform: Platform): Promise<boolean> {
  const connection = await getConnection(businessId, platform);
  return !!connection && !!connection.account_id && !!connection.access_token_ref;
}

export interface UpsertConnectionInput {
  businessId: string;
  platform: Platform;
  accountId?: string | null;
  accountName?: string | null;
  accessTokenRef?: string | null;
  refreshTokenRef?: string | null;
  scopes?: string | null;
  status?: ConnectionStatus;
  expiresAt?: string | null;
}

export async function upsertConnection(input: UpsertConnectionInput): Promise<void> {
  const { error } = await supabase.from("platform_connection").upsert(
    {
      business_id: input.businessId,
      platform: input.platform,
      account_id: input.accountId ?? null,
      account_name: input.accountName ?? null,
      access_token_ref: input.accessTokenRef ?? null,
      refresh_token_ref: input.refreshTokenRef ?? null,
      scopes: input.scopes ?? null,
      ...(input.status ? { status: input.status } : {}),
      expires_at: input.expiresAt ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "business_id,platform" }
  );
  if (error) throw error;
}

export async function markPosted(businessId: string, platform: Platform): Promise<void> {
  const { error } = await supabase
    .from("platform_connection")
    .update({ last_posted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("business_id", businessId)
    .eq("platform", platform);
  if (error) throw error;
}

export async function markMetricsSynced(businessId: string, platform: Platform): Promise<void> {
  const { error } = await supabase
    .from("platform_connection")
    .update({ last_metrics_sync_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("business_id", businessId)
    .eq("platform", platform);
  if (error) throw error;
}

/** Records a dispatch/refresh failure. Does not downgrade a 'verified' status
 * destructively — a verified platform that hits a transient failure becomes
 * 'failed' (actionable, surfaced in connection summary) rather than silently
 * staying 'verified', but we don't invent a status for connections that were
 * never confirmed in the first place beyond their current state. */
/** Classifies a raw dispatch/refresh error string into the most specific
 * connection state it actually matches — falls back to the generic "failed"
 * rather than guessing a more specific state the error text doesn't support. */
export function classifyFailure(reason: string): ConnectionStatus {
  const normalized = reason.toLowerCase();
  if (normalized.includes("permission") || normalized.includes("scope")) return "missing_permissions";
  if (normalized.includes("refresh")) return "failed_refresh";
  return "failed";
}

export async function recordFailure(businessId: string, platform: Platform, reason: string): Promise<void> {
  const existing = await getConnection(businessId, platform);
  const nextStatus: ConnectionStatus = existing?.status === "expired" ? "expired" : classifyFailure(reason);

  const { error } = await supabase.from("platform_connection").upsert(
    {
      business_id: businessId,
      platform,
      status: nextStatus,
      failure_reason: reason,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "business_id,platform" }
  );
  if (error) throw error;
}

export interface ConnectionSummary {
  platform: string;
  status: string;
  lastPostedAt: string | null;
  lastMetricsSyncAt: string | null;
  failureReason: string | null;
  actionRequired: boolean;
}

export async function getConnectionSummary(businessId: string): Promise<ConnectionSummary[]> {
  const connections = await getConnectionsForBusiness(businessId);
  return connections.map((c) => ({
    platform: c.platform,
    status: c.status,
    lastPostedAt: c.last_posted_at,
    lastMetricsSyncAt: c.last_metrics_sync_at,
    failureReason: c.failure_reason,
    actionRequired:
      c.status === "expiring" ||
      c.status === "expired" ||
      c.status === "failed" ||
      c.status === "missing_permissions" ||
      c.status === "failed_refresh",
  }));
}
