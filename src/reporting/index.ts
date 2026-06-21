import { supabase } from "../lib/supabase.js";
import { sendApprovalEmail } from "../approval/email.js";
import { sendApprovalSms } from "../approval/sms.js";
import { isLivePlatform } from "../lib/platformStatus.js";
import { getConnectionSummary } from "../lib/platformConnection.js";
import { getLeadEventsForBusiness } from "../lib/leadEvents.js";
import { getLeadIntentMessages } from "../lib/customerMessaging.js";
import { findRepeatedComplaintThemes, THEME_LABELS } from "../lib/complaintThemes.js";
import { getOrganizationForBusiness, orgDisplayName } from "../lib/orgSettings.js";
import { getLatestVisibilityScore, getRankedOrgVisibilityRollup } from "../visibility-score/index.js";
import { getRecentlyResolvedFixes } from "../lib/nextBestFix.js";
import { getBoostPerformance } from "../lib/boostReport.js";
import { withRetry } from "../lib/retry.js";
import { getReportBranding, buildBrandedReportHtml } from "../lib/reportBranding.js";
import type { Business, DistributionFailure, Organization, Post } from "../types.js";

function formatWeekOf(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric" });
}

interface WeeklyReportData {
  publishedCount: number;
  pendingCount: number;
  failedCount: number;
  totalViews: number;
  totalEngagement: number;
  totalCalls: number;
  boostedCount: number;
  needsReconnection: { platform: string }[];
  recurringFailurePlatforms: [string, number][];
  leadCount: number;
  attributedRevenueCents: number;
  leadIntentMessageCount: number;
  bestPost: Post | null;
}

/** Fetches the raw per-business counts a weekly report is built from,
 * reused by both the single-business report (buildWeeklyReport) and the
 * org-level rollup (buildOrgWeeklyReport) so the query logic isn't
 * duplicated across the two. */
async function fetchWeeklyReportData(business: Business, weekAgo: string): Promise<WeeklyReportData> {
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

  // Phase 8.8: lead_intent customer messages, surfaced as a count only — the
  // owner sees these via the inbox (getInboxForBusiness)/CRM webhook, not a
  // dump of message bodies into the digest.
  const leadIntentMessages = await getLeadIntentMessages(business.id, weekAgo);

  return {
    publishedCount: typedPosts.length,
    pendingCount: (pendingItems ?? []).length,
    failedCount: (failures ?? []).length,
    totalViews,
    totalEngagement,
    totalCalls,
    boostedCount: (boosts ?? []).length,
    needsReconnection,
    recurringFailurePlatforms,
    leadCount: leadEvents.length,
    attributedRevenueCents,
    leadIntentMessageCount: leadIntentMessages.length,
    bestPost: typedPosts.length > 0 ? typedPosts.reduce((best, p) => (p.views > best.views ? p : best)) : null,
  };
}

export async function buildWeeklyReport(business: Business): Promise<string> {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const data = await fetchWeeklyReportData(business, weekAgo);
  const organization = await getOrganizationForBusiness(business);
  const score = await getLatestVisibilityScore(business.id);

  const lines = [
    `Your ${orgDisplayName(organization)} Update — Week of ${formatWeekOf(new Date())}`,
  ];

  if (score) {
    const trendLine = score.trend === null ? "" : score.trend >= 0 ? ` (+${score.trend} from last week)` : ` (${score.trend} from last week)`;
    lines.push(`📊 Visibility score: ${score.score}/100${trendLine}`);
  }

  lines.push(
    `✅ ${data.publishedCount} post${data.publishedCount === 1 ? "" : "s"} published`,
    `🕓 ${data.pendingCount} post${data.pendingCount === 1 ? "" : "s"} pending`,
    `⚠️ ${data.failedCount} post${data.failedCount === 1 ? "" : "s"} failed`,
    `👀 ${data.totalViews} views, 💬 ${data.totalEngagement} engagements`,
    `📞 ${data.totalCalls} calls came from your Google profile`
  );

  if (data.bestPost) {
    lines.push(`🏆 Best performing post: ${data.bestPost.platform} — ${data.bestPost.views} views, ${data.bestPost.engagement} engagements`);
  }

  if (data.needsReconnection.length > 0) {
    lines.push(
      `🔌 ${data.needsReconnection.length} platform${data.needsReconnection.length === 1 ? "" : "s"} need${data.needsReconnection.length === 1 ? "s" : ""} reconnection: ${data.needsReconnection.map((c) => c.platform).join(", ")}`
    );
  }

  for (const [platform, count] of data.recurringFailurePlatforms) {
    lines.push(`⚠️ Repeated failures on ${platform} (${count}x this week) — check your connection.`);
  }

  if (data.boostedCount > 0) {
    lines.push(`🚀 ${data.boostedCount} post${data.boostedCount === 1 ? "" : "s"} turned into paid ads this week`);
  }

  // Phase 8.5: per-boost spend/attribution — leads/revenue only when a real
  // lead_event ties back to that boost's post, never a fabricated estimate.
  const boostPerformance = await getBoostPerformance(business.id, weekAgo);
  for (const entry of boostPerformance) {
    const spent = (entry.spentCents / 100).toFixed(2);
    lines.push(`💸 Boosted ${entry.platform} post: $${spent} spent, ${entry.clicks} clicks, ${entry.engagement} engagement`);
    if (entry.leadCount !== null) {
      const revenueLine = entry.attributedRevenueCents ? `$${(entry.attributedRevenueCents / 100).toFixed(2)} attributed revenue, ` : "";
      lines.push(`   ↳ ${revenueLine}${entry.leadCount} lead${entry.leadCount === 1 ? "" : "s"} from this boost`);
    }
  }

  if (data.leadCount > 0) {
    const revenueLine = data.attributedRevenueCents > 0 ? `$${(data.attributedRevenueCents / 100).toFixed(2)} attributed revenue, ` : "";
    lines.push(`💰 ${revenueLine}${data.leadCount} lead${data.leadCount === 1 ? "" : "s"} this week`);
  }

  if (data.leadIntentMessageCount > 0) {
    lines.push(
      `📩 ${data.leadIntentMessageCount} customer message${data.leadIntentMessageCount === 1 ? "" : "s"} this week looked like a lead — check your inbox.`
    );
  }

  const resolvedFixes = await getRecentlyResolvedFixes(business.id);
  for (const fix of resolvedFixes) {
    lines.push(`🎉 Fixed last week: ${fix.category} (was: ${fix.recommendation})`);
  }

  if (score?.nextBestFix) {
    lines.push(`👉 Next best fix: ${score.nextBestFix}`);
  }

  // Phase 9.3: a 30-day window, not the weekly one above — a repeated theme
  // is a pattern across reviews accumulated over time, not just this week's.
  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const repeatedThemes = await findRepeatedComplaintThemes(business.id, monthAgo);
  for (const { theme, count } of repeatedThemes) {
    lines.push(`📝 ${count} reviews this month mentioned ${THEME_LABELS[theme]} — worth a look.`);
  }

  return lines.join("\n");
}

export async function sendWeeklyReport(business: Business): Promise<void> {
  const report = await buildWeeklyReport(business);

  const organization = await getOrganizationForBusiness(business);
  if (business.owner_phone) {
    await withRetry(() => sendApprovalSms(business.owner_phone!, report, organization?.twilio_from_number ?? null));
  } else if (business.owner_email) {
    const branding = await getReportBranding(business);
    const html = branding ? buildBrandedReportHtml(report, branding) : undefined;
    await withRetry(() => sendApprovalEmail(business.owner_email!, `Your ${orgDisplayName(organization)} Weekly Update`, report, html));
  }
}

/** Phase 4.3: consolidated org-level rollup of every business's weekly
 * counts, plus a per-location benchmarking line (published-post count and
 * total views, sorted highest first) for bulk reporting across an org's
 * locations. */
export async function buildOrgWeeklyReport(organizationId: string): Promise<string> {
  const { data: organization, error: organizationError } = await supabase
    .from("organization")
    .select("*")
    .eq("id", organizationId)
    .single();
  if (organizationError) throw organizationError;

  const { data: businesses, error: businessesError } = await supabase
    .from("business")
    .select("*")
    .eq("organization_id", organizationId);
  if (businessesError) throw businessesError;

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  let publishedCount = 0;
  let pendingCount = 0;
  let failedCount = 0;
  let leadCount = 0;
  const benchmark: { name: string; published: number; views: number }[] = [];

  for (const business of (businesses ?? []) as Business[]) {
    const data = await fetchWeeklyReportData(business, weekAgo);
    publishedCount += data.publishedCount;
    pendingCount += data.pendingCount;
    failedCount += data.failedCount;
    leadCount += data.leadCount;
    benchmark.push({ name: business.name, published: data.publishedCount, views: data.totalViews });
  }

  benchmark.sort((a, b) => b.views - a.views);

  // Phase 9.2: visibility-score ranking, a separate comparison axis from the
  // by-views benchmark above — unscored locations are listed but never
  // ranked ahead of a real score.
  const ranked = await getRankedOrgVisibilityRollup(organizationId);

  const lines = [
    `${orgDisplayName(organization as Organization)} Org Update — Week of ${formatWeekOf(new Date())} — ${(businesses ?? []).length} location${(businesses ?? []).length === 1 ? "" : "s"}`,
    `✅ ${publishedCount} post${publishedCount === 1 ? "" : "s"} published across all locations`,
    `🕓 ${pendingCount} post${pendingCount === 1 ? "" : "s"} pending`,
    `⚠️ ${failedCount} post${failedCount === 1 ? "" : "s"} failed`,
    `💰 ${leadCount} lead${leadCount === 1 ? "" : "s"} this week`,
    "",
    "Per-location benchmark (by views):",
    ...benchmark.map((b, i) => `${i + 1}. ${b.name} — ${b.published} published, ${b.views} views`),
    "",
    "Visibility score ranking:",
    ...ranked.map((l) =>
      l.rank !== null
        ? `${l.rank}. ${l.businessName} — ${l.score}/100${l.gapFromOrgAverage !== null ? ` (${l.gapFromOrgAverage >= 0 ? "+" : ""}${l.gapFromOrgAverage} vs org avg)` : ""}`
        : `— ${l.businessName} — not yet scored`
    ),
  ];

  return lines.join("\n");
}
