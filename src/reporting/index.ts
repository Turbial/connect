import { supabase } from "../lib/supabase.js";
import { sendApprovalEmail } from "../approval/email.js";
import { sendApprovalSms } from "../approval/sms.js";
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

  const typedPosts = (posts ?? []) as Post[];
  const totalViews = typedPosts.reduce((sum, p) => sum + p.views, 0);
  const totalCalls = typedPosts.reduce((sum, p) => sum + p.calls, 0);

  return [
    `Your MightyMax Update — Week of ${formatWeekOf(new Date())}`,
    `✅ ${typedPosts.length} post${typedPosts.length === 1 ? "" : "s"} went live on Google`,
    `👀 ${totalViews} people saw your posts`,
    `📞 ${totalCalls} calls came from your Google profile`,
  ].join("\n");
}

export async function sendWeeklyReport(business: Business): Promise<void> {
  const report = await buildWeeklyReport(business);

  if (business.owner_phone) {
    await sendApprovalSms(business.owner_phone, report);
  } else if (business.owner_email) {
    await sendApprovalEmail(business.owner_email, "Your MightyMax Weekly Update", report);
  }
}
