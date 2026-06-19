import { supabase } from "./supabase.js";
import { getLatestVisibilityScore, getVerticalBenchmark } from "../visibility-score/index.js";
import { getConnectionSummary } from "./platformConnection.js";
import { getRecentAgentActions } from "./agentAction.js";
import { getPendingBoostTriggers } from "../approval/boost.js";
import type { Business, BoostTrigger, Review } from "../types.js";

export interface PendingApprovalSummary {
  contentItemId: string;
  channel: string;
  sentAt: string;
}

export interface UnresolvedReviewSummary {
  id: string;
  rating: number | null;
  text: string | null;
  customerName: string | null;
  receivedAt: string;
}

export interface OperatorSnapshot {
  business: { id: string; name: string; vertical: string | null };
  visibilityScore: Awaited<ReturnType<typeof getLatestVisibilityScore>>;
  connections: Awaited<ReturnType<typeof getConnectionSummary>>;
  pendingApprovals: PendingApprovalSummary[];
  pendingBoosts: BoostTrigger[];
  unresolvedReviews: UnresolvedReviewSummary[];
  recentActions: Awaited<ReturnType<typeof getRecentAgentActions>>;
  /** Phase 9.4: a vertical peer-median, explicitly labeled as an early signal
   * rather than a finished competitive benchmark — null below the minimum
   * peer sample size (see MIN_BENCHMARK_SAMPLE), never a number from 1-2 peers. */
  early_benchmark_signal: Awaited<ReturnType<typeof getVerticalBenchmark>>;
}

/** Negative reviews are the ones an owner actually needs to act on — there's
 * no separate "resolved" tracking column on `review`, so a low rating is the
 * signal used to flag a review as needing attention. */
const NEGATIVE_REVIEW_RATING_CEILING = 3;

/** Pending owner approvals (content not yet approved/declined) for a business. */
export async function getPendingApprovals(businessId: string): Promise<PendingApprovalSummary[]> {
  const { data: items, error: itemsError } = await supabase.from("content_item").select("id").eq("business_id", businessId);
  if (itemsError) throw itemsError;
  const itemIds = (items ?? []).map((i) => i.id as string);
  if (itemIds.length === 0) return [];

  const { data: requests, error: requestsError } = await supabase
    .from("approval_request")
    .select("content_item_id, channel, sent_at")
    .in("content_item_id", itemIds)
    .is("responded_at", null);
  if (requestsError) throw requestsError;
  return (requests ?? []).map((r) => ({
    contentItemId: r.content_item_id as string,
    channel: r.channel as string,
    sentAt: r.sent_at as string,
  }));
}

/** Phase 8.9: read-only assembly of everything an operator (owner or future
 * agent) needs to see a business's current state at a glance — built entirely
 * from data already computed by prior phases, no new collection logic. */
export async function buildOperatorSnapshot(businessId: string): Promise<OperatorSnapshot | null> {
  const { data: business, error: businessError } = await supabase.from("business").select("*").eq("id", businessId).maybeSingle();
  if (businessError) throw businessError;
  if (!business) return null;
  const businessRow = business as Business;

  const [visibilityScore, connections, pendingBoosts, recentActions] = await Promise.all([
    getLatestVisibilityScore(businessId),
    getConnectionSummary(businessId),
    getPendingBoostTriggers(businessId),
    getRecentAgentActions(businessId),
  ]);

  const pendingApprovals = await getPendingApprovals(businessId);
  const early_benchmark_signal = await getVerticalBenchmark(businessRow.vertical ?? "general", businessId);

  const { data: reviews, error: reviewsError } = await supabase
    .from("review")
    .select("*")
    .eq("business_id", businessId)
    .lte("rating", NEGATIVE_REVIEW_RATING_CEILING)
    .order("received_at", { ascending: false })
    .limit(10);
  if (reviewsError) throw reviewsError;
  const unresolvedReviews = ((reviews ?? []) as Review[]).map((r) => ({
    id: r.id,
    rating: r.rating,
    text: r.text,
    customerName: r.customer_name,
    receivedAt: r.received_at,
  }));

  return {
    business: { id: businessRow.id, name: businessRow.name, vertical: businessRow.vertical ?? null },
    visibilityScore,
    connections,
    pendingApprovals,
    pendingBoosts,
    unresolvedReviews,
    recentActions,
    early_benchmark_signal,
  };
}
