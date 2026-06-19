import { supabase } from "../lib/supabase.js";
import { sendApprovalEmail } from "../approval/email.js";
import { sendApprovalSms } from "../approval/sms.js";
import { isLivePlatform } from "../lib/platformStatus.js";
import { getConnectionSummary } from "../lib/platformConnection.js";
import type { Business, Post } from "../types.js";

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
    .select("id")
    .eq("business_id", business.id)
    .gte("occurred_at", weekAgo);
  if (failuresError) throw failuresError;

  const connectionSummary = await getConnectionSummary(business.id);
  const needsReconnection = connectionSummary.filter((c) => c.actionRequired);

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

  if ((boosts ?? []).length > 0) {
    lines.push(`🚀 ${boosts!.length} post${boosts!.length === 1 ? "" : "s"} turned into paid ads this week`);
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
