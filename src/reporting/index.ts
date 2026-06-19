import { supabase } from "../lib/supabase.js";
import { sendApprovalEmail } from "../approval/email.js";
import { sendApprovalSms } from "../approval/sms.js";
import { isLivePlatform } from "../lib/platformStatus.js";
import { getConnectionSummary } from "../lib/platformConnection.js";
import { getLeadEventsForBusiness } from "../lib/leadEvents.js";
import type { Business, DistributionFailure, Post } from "../types.js";

function formatWeekOf(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric" });
}

export async function buildWeeklyReport(business: Business): Promise<string> {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: items, error } = await supabase
    .from("content_item")
    .select("id")
    .eq("business_id", business.id)
    .eq("status", "posted")
    .gte("created_at", weekAgo);
  if (error) throw error;

  const itemIds = (items ?? []).map((i) => i.id);

  const { data: posts, error: postsError } = await supabase
    .from("post")
    .select("*")
    .in("content_item_id", itemIds.length > 0 ? itemIds : ["00000000-0000-0000-0000-000000000000"]);
  if (postsError) throw postsError;

  // Distribution already skips dispatch to stub/unsupported platforms, so no
  // "post" row should exist for one — but filter defensively so a digest
  // never reports activity for a platform that doesn't actually publish.
  const typedPosts = ((posts ?? []) as Post[]).filter((p) => isLivePlatform(p.platform));
  const totalViews = typedPosts.reduce((sum, p) => sum + p.views, 0);
  const totalCalls = typedPosts.reduce((sum, p) => sum + p.calls, 0);
  const totalEngagement = typedPosts.reduce((sum, p) => sum + p.engagement, 0);

  const { data: boosts, error: boostError } = await supabase
    .from("boost_trigger")
    .select("*")
    .eq("handed_off_to_marketing", true)
    .in("post_id", typedPosts.map((p) => p.id).length > 0 ? typedPosts.map((p) => p.id) : ["00000000-0000-0000-0000-000000000000"]);
  if (boostError) throw boostError;

  const { data: pendingItems, error: pendingError } = await supabase
    .from("content_item")
    .select("id")
    .eq("business_id", business.id)
    .in("status", ["queued", "approved"]);
  if (pendingError) throw pendingError;

  const { data: failures, error: failuresError } = await supabase
    .from("distribution_failure")
    .select("*")
    .eq("business_id", business.id)
    .gte("occurred_at", weekAgo);
  if (failuresError) throw failuresError;

  const connectionSummary = await getConnectionSummary(business.id);
  const needsReconnection = connectionSummary.filter((c) => c.actionRequired);

  // Phase 3.3: a recurring failure on the same platform (3+ in the window) is
  // a distinct, more actionable signal than the generic failed-post count —
  // it points at one broken connection, not scattered one-off errors.
  const failuresByPlatform = new Map<string, number>();
  for (const f of (failures ?? []) as DistributionFailure[]) {
    failuresByPlatform.set(f.platform, (failuresByPlatform.get(f.platform) ?? 0) + 1);
  }
  const recurringFailurePlatforms = [...failuresByPlatform.entries()].filter(([, count]) => count >= 3);

  // Phase 3.1: lead/revenue attribution from lead_event, additive to the GBP
  // post.calls figure above. Only shown when there's at least one event in
  // the window so reports don't show a fake $0 line for businesses with no
  // attribution data wired up yet.
  const leadEvents = await getLeadEventsForBusiness(business.id, weekAgo);
  const attributedRevenueCents = leadEvents.reduce((sum, e) => sum + (e.amount_cents ?? 0), 0);

  const lines = [
    `Your MightyMax Update — Week of ${formatWeekOf(new Date())}`,
    `✅ ${typedPosts.length} post${typedPosts.length === 1 ? "" : "s"} published`,
    `🕓 ${(pendingItems ?? []).length} post${(pendingItems ?? []).length === 1 ? "" : "s"} pending`,
    `⚠️ ${(failures ?? []).length} post${(failures ?? []).length === 1 ? "" : "s"} failed`,
    `👀 ${totalViews} views, 💬 ${totalEngagement} engagements`,
    `📞 ${totalCalls} calls came from your Google profile`,
  ];

  if (needsReconnection.length > 0) {
    lines.push(
      `🔌 ${needsReconnection.length} platform${needsReconnection.length === 1 ? "" : "s"} need${needsReconnection.length === 1 ? "s" : ""} reconnection: ${needsReconnection.map((c) => c.platform).join(", ")}`
    );
  }

  for (const [platform, count] of recurringFailurePlatforms) {
    lines.push(`⚠️ Repeated failures on ${platform} (${count}x this week) — check your connection.`);
  }

  if ((boosts ?? []).length > 0) {
    lines.push(`🚀 ${boosts!.length} post${boosts!.length === 1 ? "" : "s"} turned into paid ads this week`);
  }

  if (leadEvents.length > 0) {
    const revenueLine = attributedRevenueCents > 0 ? `$${(attributedRevenueCents / 100).toFixed(2)} attributed revenue, ` : "";
    lines.push(`💰 ${revenueLine}${leadEvents.length} lead${leadEvents.length === 1 ? "" : "s"} this week`);
  }

  return lines.join("\n");
}

export async function sendWeeklyReport(business: Business): Promise<void> {
  const report = await buildWeeklyReport(business);

  if (business.owner_phone) {
    await sendApprovalSms(business.owner_phone, report);
  } else if (business.owner_email) {
    await sendApprovalEmail(business.owner_email, "Your MightyMax Weekly Update", report);
  }
}
