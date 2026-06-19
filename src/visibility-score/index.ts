import { supabase } from "../lib/supabase.js";
import { recordNextBestFixSuggestions } from "../lib/nextBestFix.js";
import type { Business, DataConfidence, ScoreDriver, ServiceSignal, Vertical, VisibilityScore } from "../types.js";
import { industryInsightFor, weightedScore, weightTableFor } from "./weights.js";

/**
 * Phase 3.2: aggregates the most recent signal from each of the 18 audit/
 * service-module rows into one 0-100 score with a category breakdown.
 *
 * Category mapping (10 categories per DEVELOPMENT_PROGRAM.md, 18 modules):
 *   - listings              -> listing_sync, local-citation-count
 *   - reviews               -> social-proof-badge, duplicate-review-flag, sentiment_trend
 *   - website health        -> page-speed, mobile-friendliness, structured-data
 *   - search presence       -> rank_snapshot, seo_audit, duplicate_listing_flag, backlink-count
 *   - social activity       -> social-follower-count
 *   - content freshness     -> content-freshness
 *   - competitor strength   -> competitor_snapshot
 *   - ads readiness         -> business.meta_ads_account_id / google_ads_customer_id
 *   - response rate         -> review-response-rate, business-hours-consistency
 *   - profile completeness  -> seo_audit issues, image-alt-coverage
 *
 * Some modules feed more than one category (e.g. seo_audit's issue list spans
 * both search presence and profile completeness) since the underlying issues
 * list mixes NAP/profile gaps with connection gaps — judgment call, not a
 * strict partition.
 */

const RECOMMENDATION_THRESHOLD = 70;

/** Phase 6.1: a signal older than this no longer counts as "verified" for the
 * data-confidence label, even though its score still feeds the category
 * (changing the score itself for stale data would be a second, conflated
 * judgment call — confidence is reported separately instead). */
const STALE_DAYS = 14;

/** Worst-case-wins ordering so a category with any missing input is labeled
 * "missing" rather than averaging confidence levels across its inputs. */
function worseConfidence(a: DataConfidence, b: DataConfidence): DataConfidence {
  const rank: Record<DataConfidence, number> = { missing: 0, stale: 1, verified: 2 };
  return rank[a] <= rank[b] ? a : b;
}

/** Phase 6.1: classifies a single underlying input as verified/stale/missing.
 * `value === null/undefined` means the signal was never captured at all;
 * a present value with a timestamp older than STALE_DAYS is "stale" rather
 * than fabricated as current; anything else (present, no timestamp, or
 * within the window) is "verified". */
function confidenceFor(value: unknown, timestamp?: string | null): DataConfidence {
  if (value === null || value === undefined) return "missing";
  if (!timestamp) return "verified";
  const ageDays = (Date.now() - new Date(timestamp).getTime()) / (1000 * 60 * 60 * 24);
  return ageDays > STALE_DAYS ? "stale" : "verified";
}

interface LatestSignals {
  byModule: Map<string, ServiceSignal>;
}

async function fetchLatestSignals(businessId: string): Promise<LatestSignals> {
  const { data, error } = await supabase
    .from("service_signal")
    .select("*")
    .eq("business_id", businessId)
    .order("captured_at", { ascending: false });
  if (error) throw error;

  const byModule = new Map<string, ServiceSignal>();
  for (const row of (data ?? []) as ServiceSignal[]) {
    if (!byModule.has(row.module)) byModule.set(row.module, row);
  }
  return { byModule };
}

function boolSignal(signals: LatestSignals, module: string): boolean | null {
  const row = signals.byModule.get(module);
  if (!row || row.value === null) return null;
  return row.value === "true";
}

function numericSignal(signals: LatestSignals, module: string): number | null {
  const row = signals.byModule.get(module);
  if (!row || row.value === null) return null;
  const n = Number(row.value);
  return Number.isFinite(n) ? n : null;
}

/** Confidence for a service-module-backed signal, using that module's own
 * captured_at — distinct from confidenceFor's generic timestamp handling
 * because the value and the timestamp both live on the same signals row. */
function moduleConfidence(signals: LatestSignals, module: string): DataConfidence {
  const row = signals.byModule.get(module);
  return confidenceFor(row?.value ?? null, row?.captured_at ?? null);
}

// ── Per-module normalizers: each maps that module's raw value to 0-100. ────

/** business-hours-consistency: "hours_profile_complete" boolean -> 100/0. */
export function scoreFromBusinessHoursConsistency(signals: LatestSignals): number {
  const complete = boolSignal(signals, "business-hours-consistency");
  return complete === null ? 50 : complete ? 100 : 0;
}

/** social-proof-badge: "badge_eligible" boolean -> 100/40 (not eligible isn't
 * necessarily bad, just not yet earned, so it's not scored to 0). */
export function scoreFromSocialProofBadge(signals: LatestSignals): number {
  const eligible = boolSignal(signals, "social-proof-badge");
  return eligible === null ? 50 : eligible ? 100 : 40;
}

/** structured-data: "schema_org_ready" boolean -> 100/0. */
export function scoreFromStructuredData(signals: LatestSignals): number {
  const ready = boolSignal(signals, "structured-data");
  return ready === null ? 50 : ready ? 100 : 0;
}

/** page-speed: "lcp_score" — currently always null until PageSpeed API key is
 * configured (see src/service-modules-12/page-speed), so this is a neutral
 * midpoint placeholder rather than penalizing every business for an
 * unconfigured integration. Once a real LCP value lands, lower is better
 * (capped at a reasonable LCP range). */
export function scoreFromPageSpeed(signals: LatestSignals): number {
  const lcp = numericSignal(signals, "page-speed");
  if (lcp === null) return 50;
  if (lcp <= 0) return 50; // unconfigured "0" placeholder, same neutral treatment
  return Math.max(0, Math.min(100, 100 - (lcp - 2.5) * 20));
}

/** backlink-count: currently always null (no provider wired), neutral midpoint. */
export function scoreFromBacklinkCount(signals: LatestSignals): number {
  const count = numericSignal(signals, "backlink-count");
  if (count === null) return 50;
  return Math.max(0, Math.min(100, count * 2));
}

/** local-citation-count: connected-platform count as a citation proxy,
 * scaled against a reasonable "well-covered" target of 10 platforms. */
export function scoreFromLocalCitationCount(signals: LatestSignals): number {
  const count = numericSignal(signals, "local-citation-count");
  if (count === null) return 50;
  return Math.max(0, Math.min(100, (count / 10) * 100));
}

/** social-follower-count: connected-platform count proxy (no real follower
 * read API wired yet), same scaling as local-citation-count. */
export function scoreFromSocialFollowerCount(signals: LatestSignals): number {
  const count = numericSignal(signals, "social-follower-count");
  if (count === null) return 50;
  return Math.max(0, Math.min(100, (count / 10) * 100));
}

/** review-response-rate: "response_rate" 0-1 -> 0-100 directly. */
export function scoreFromReviewResponseRate(signals: LatestSignals): number {
  const rate = numericSignal(signals, "review-response-rate");
  if (rate === null) return 50;
  return Math.round(rate * 100);
}

/** content-freshness: "days_since_last_post" — fresher is better; 0 days = 100,
 * decays linearly to 0 at 30+ days stale. */
export function scoreFromContentFreshness(signals: LatestSignals): number {
  const days = numericSignal(signals, "content-freshness");
  if (days === null) return 50;
  return Math.max(0, Math.min(100, 100 - (days / 30) * 100));
}

/** duplicate-review-flag: "duplicate_review_detected" boolean -> 100 clean / 30 flagged. */
export function scoreFromDuplicateReviewFlag(signals: LatestSignals): number {
  const detected = boolSignal(signals, "duplicate-review-flag");
  return detected === null ? 50 : detected ? 30 : 100;
}

/** image-alt-coverage: "alt_text_coverage" 0-1 -> 0-100 directly. */
export function scoreFromImageAltCoverage(signals: LatestSignals): number {
  const coverage = numericSignal(signals, "image-alt-coverage");
  if (coverage === null) return 50;
  return Math.round(coverage * 100);
}

/** mobile-friendliness: "mobile_friendly" — modeled as a boolean-ish string
 * ("true"/null), same unconfigured-key neutral treatment as page-speed. */
export function scoreFromMobileFriendliness(signals: LatestSignals): number {
  const row = signals.byModule.get("mobile-friendliness");
  if (!row || row.value === null) return 50;
  return row.value === "true" ? 100 : 0;
}

/** seo_audit: stored score (0-100 already, from 100 - issues*10) used as-is. */
export function scoreFromSeoAudit(score: number | null): number {
  return score ?? 50;
}

/** duplicate-listing-check: more flagged candidate listings is worse; 0 flags
 * is a clean 100, decaying by 25 points per flag. */
export function scoreFromDuplicateListings(flagCount: number): number {
  return Math.max(0, 100 - flagCount * 25);
}

/** rank-tracker: most recent keyword rank, lower (closer to #1) is better;
 * unranked (null) scores 0, rank 1 scores 100, decaying past rank 10. */
export function scoreFromRankTracker(rank: number | null): number {
  if (rank === null) return 0;
  return Math.max(0, 100 - (rank - 1) * 10);
}

/** sentiment-tracker: avg_rating on a 1-5 scale -> 0-100. */
export function scoreFromSentimentTracker(avgRating: number | null): number {
  if (avgRating === null) return 50;
  return Math.round(Math.max(0, Math.min(100, ((avgRating - 1) / 4) * 100)));
}

/** competitor-monitor: business has no direct rating of its own here — this
 * scores "competitor strength" inversely from how many competitors are
 * outperforming the business's own sentiment average (best-effort, since a
 * true relative-rank comparison needs both numbers fetched by the caller). */
export function scoreFromCompetitorMonitor(ownAvgRating: number | null, competitorRatings: number[]): number {
  if (ownAvgRating === null || competitorRatings.length === 0) return 50;
  const outperforming = competitorRatings.filter((r) => r > ownAvgRating).length;
  return Math.max(0, 100 - (outperforming / competitorRatings.length) * 100);
}

/** listings (NAP sync): most recent listing_sync status -> 100 success / 0 failed. */
export function scoreFromListingSync(status: "success" | "failed" | null): number {
  if (status === null) return 50;
  return status === "success" ? 100 : 0;
}

/** ads readiness: business has at least one ad account connected. */
export function scoreFromAdsReadiness(business: Business): number {
  return business.meta_ads_account_id || business.google_ads_customer_id ? 100 : 0;
}

interface CategoryResult {
  score: number;
  recommendation: string | null;
  confidence: DataConfidence;
}

async function computeCategories(business: Business, signals: LatestSignals): Promise<Record<string, CategoryResult>> {
  const { data: seoAudits } = await supabase
    .from("seo_audit")
    .select("*")
    .eq("business_id", business.id)
    .order("run_at", { ascending: false })
    .limit(1);
  const seoAudit = (seoAudits ?? [])[0] as { score: number; issues: string[]; run_at: string } | undefined;

  const { data: dupListings } = await supabase
    .from("duplicate_listing_flag")
    .select("id")
    .eq("business_id", business.id);

  const { data: rankSnapshots } = await supabase
    .from("rank_snapshot")
    .select("*")
    .eq("business_id", business.id)
    .order("captured_at", { ascending: false })
    .limit(1);
  const latestRank = (rankSnapshots ?? [])[0] as { rank: number | null; captured_at: string } | undefined;

  const { data: sentimentTrends } = await supabase
    .from("sentiment_trend")
    .select("*")
    .eq("business_id", business.id)
    .order("period_end", { ascending: false })
    .limit(1);
  const latestSentiment = (sentimentTrends ?? [])[0] as { avg_rating: number; period_end: string } | undefined;

  const { data: listingSyncs } = await supabase
    .from("listing_sync")
    .select("*")
    .eq("business_id", business.id)
    .order("synced_at", { ascending: false })
    .limit(1);
  const latestListingSync = (listingSyncs ?? [])[0] as { status: "success" | "failed"; synced_at: string } | undefined;

  const { data: competitors } = await supabase.from("competitor").select("id").eq("business_id", business.id);
  let competitorRatings: number[] = [];
  if (competitors && competitors.length > 0) {
    const { data: snapshots } = await supabase
      .from("competitor_snapshot")
      .select("rating")
      .in("competitor_id", competitors.map((c) => c.id))
      .not("rating", "is", null);
    competitorRatings = (snapshots ?? []).map((s) => s.rating as number);
  }

  const listingsScore = Math.round((scoreFromListingSync(latestListingSync?.status ?? null) + scoreFromLocalCitationCount(signals)) / 2);
  const reviewsScore = Math.round(
    (scoreFromSocialProofBadge(signals) + scoreFromDuplicateReviewFlag(signals) + scoreFromSentimentTracker(latestSentiment?.avg_rating ?? null)) / 3
  );
  const websiteHealthScore = Math.round((scoreFromPageSpeed(signals) + scoreFromMobileFriendliness(signals) + scoreFromStructuredData(signals)) / 3);
  const searchPresenceScore = Math.round(
    (scoreFromRankTracker(latestRank?.rank ?? null) +
      scoreFromSeoAudit(seoAudit?.score ?? null) +
      scoreFromDuplicateListings((dupListings ?? []).length) +
      scoreFromBacklinkCount(signals)) /
      4
  );
  const socialActivityScore = scoreFromSocialFollowerCount(signals);
  const contentFreshnessScore = scoreFromContentFreshness(signals);
  const competitorStrengthScore = scoreFromCompetitorMonitor(latestSentiment?.avg_rating ?? null, competitorRatings);
  const adsReadinessScore = scoreFromAdsReadiness(business);
  const responseRateScore = Math.round((scoreFromReviewResponseRate(signals) + scoreFromBusinessHoursConsistency(signals)) / 2);
  const profileCompletenessScore = Math.round((scoreFromSeoAudit(seoAudit?.score ?? null) + scoreFromImageAltCoverage(signals)) / 2);

  const dupListingCount = (dupListings ?? []).length;
  const hoursComplete = boolSignal(signals, "business-hours-consistency");
  const responseRate = numericSignal(signals, "review-response-rate");
  const altCoverage = numericSignal(signals, "image-alt-coverage");
  const daysStale = numericSignal(signals, "content-freshness");

  // Worst-case confidence across each category's contributing inputs — a
  // category is only "verified" if every input behind it is.
  const listingsConfidence = worseConfidence(
    confidenceFor(latestListingSync?.status ?? null, latestListingSync?.synced_at),
    moduleConfidence(signals, "local-citation-count")
  );
  const reviewsConfidence = worseConfidence(
    worseConfidence(moduleConfidence(signals, "social-proof-badge"), moduleConfidence(signals, "duplicate-review-flag")),
    confidenceFor(latestSentiment?.avg_rating ?? null, latestSentiment?.period_end)
  );
  const websiteHealthConfidence = worseConfidence(
    worseConfidence(moduleConfidence(signals, "page-speed"), moduleConfidence(signals, "mobile-friendliness")),
    moduleConfidence(signals, "structured-data")
  );
  const searchPresenceConfidence = worseConfidence(
    worseConfidence(confidenceFor(latestRank?.rank ?? null, latestRank?.captured_at), confidenceFor(seoAudit?.score ?? null, seoAudit?.run_at)),
    moduleConfidence(signals, "backlink-count")
  );
  const socialActivityConfidence = moduleConfidence(signals, "social-follower-count");
  const contentFreshnessConfidence = moduleConfidence(signals, "content-freshness");
  const competitorStrengthConfidence =
    competitorRatings.length === 0 ? "missing" : confidenceFor(latestSentiment?.avg_rating ?? null, latestSentiment?.period_end);
  const adsReadinessConfidence: DataConfidence = "verified"; // live business field, not a captured signal
  const responseRateConfidence = worseConfidence(moduleConfidence(signals, "review-response-rate"), moduleConfidence(signals, "business-hours-consistency"));
  const profileCompletenessConfidence = worseConfidence(
    confidenceFor(seoAudit?.score ?? null, seoAudit?.run_at),
    moduleConfidence(signals, "image-alt-coverage")
  );

  return {
    listings: {
      score: listingsScore,
      confidence: listingsConfidence,
      recommendation:
        listingsScore < RECOMMENDATION_THRESHOLD
          ? latestListingSync?.status === "failed"
            ? "Your Google Business Profile listing sync failed — reconnect GBP and re-sync your NAP info."
            : "Connect more directories/platforms to strengthen your local citation footprint."
          : null,
    },
    reviews: {
      score: reviewsScore,
      confidence: reviewsConfidence,
      recommendation:
        reviewsScore < RECOMMENDATION_THRESHOLD
          ? boolSignal(signals, "duplicate-review-flag")
            ? "Possible duplicate/fake reviews detected — investigate and report them to the platform."
            : "Collect more 4-5 star reviews to qualify for a social-proof badge (need 10+ averaging 4.0+)."
          : null,
    },
    "website health": {
      score: websiteHealthScore,
      confidence: websiteHealthConfidence,
      recommendation:
        websiteHealthScore < RECOMMENDATION_THRESHOLD ? "Run a PageSpeed/mobile-friendliness check and fix the slowest-loading pages on your site." : null,
    },
    "search presence": {
      score: searchPresenceScore,
      confidence: searchPresenceConfidence,
      recommendation:
        searchPresenceScore < RECOMMENDATION_THRESHOLD
          ? dupListingCount > 0
            ? `${dupListingCount} possible duplicate listing${dupListingCount === 1 ? "" : "s"} found for your business name — request removal to consolidate ranking signals.`
            : "Your local search rank is low for your business name — improve NAP consistency and add fresh content to climb."
          : null,
      },
    "social activity": {
      score: socialActivityScore,
      confidence: socialActivityConfidence,
      recommendation: socialActivityScore < RECOMMENDATION_THRESHOLD ? "Connect more social platforms to widen your reach beyond your current footprint." : null,
    },
    "content freshness": {
      score: contentFreshnessScore,
      confidence: contentFreshnessConfidence,
      recommendation:
        contentFreshnessScore < RECOMMENDATION_THRESHOLD
          ? `It's been ${daysStale ?? "many"} days since your last post — approve this week's queued content to stay active.`
          : null,
    },
    "competitor strength": {
      score: competitorStrengthScore,
      confidence: competitorStrengthConfidence,
      recommendation:
        competitorStrengthScore < RECOMMENDATION_THRESHOLD ? "Tracked competitors are outrating you — focus on review generation to close the gap." : null,
    },
    "ads readiness": {
      score: adsReadinessScore,
      confidence: adsReadinessConfidence,
      recommendation: adsReadinessScore < RECOMMENDATION_THRESHOLD ? "Connect a Meta or Google Ads account so high-performing posts can be boosted." : null,
    },
    "response rate": {
      score: responseRateScore,
      confidence: responseRateConfidence,
      recommendation:
        responseRateScore < RECOMMENDATION_THRESHOLD
          ? hoursComplete === false
            ? "Your business hours/address/phone profile is incomplete — fill in the missing fields."
            : `Only ${Math.round((responseRate ?? 0) * 100)}% of reviews have a reply on file — respond to outstanding reviews.`
          : null,
    },
    "profile completeness": {
      score: profileCompletenessScore,
      confidence: profileCompletenessConfidence,
      recommendation:
        profileCompletenessScore < RECOMMENDATION_THRESHOLD
          ? seoAudit && seoAudit.issues.length > 0
            ? `${seoAudit.issues.length} profile gap${seoAudit.issues.length === 1 ? "" : "s"} found: ${seoAudit.issues[0]}.`
            : altCoverage !== null
              ? `Only ${Math.round(altCoverage * 100)}% of your images have alt text — add descriptions for accessibility/SEO.`
              : "Complete your business profile (phone, address, connections) to improve discoverability."
          : null,
    },
  };
}

const NEUTRAL_MIDPOINT = 50;

/** Phase 6.1: ranks every category by how far it pulls the overall score from
 * a neutral midpoint, so the owner sees what's actually driving the number —
 * not just an unordered breakdown. */
function rankDrivers(categoryBreakdown: Record<string, number>): ScoreDriver[] {
  return Object.entries(categoryBreakdown)
    .map(([category, score]) => ({
      category,
      score,
      direction: (score >= NEUTRAL_MIDPOINT ? "positive" : "negative") as ScoreDriver["direction"],
    }))
    .sort((a, b) => Math.abs(b.score - NEUTRAL_MIDPOINT) - Math.abs(a.score - NEUTRAL_MIDPOINT));
}

/** Phase 6.1: the single negative driver with the largest score impact that
 * has a known remediation already attached — never a generated/guessed
 * claim, just the existing per-category recommendation for the worst real
 * offender. Categories below the recommendation threshold but without a
 * recommendation string are skipped rather than fabricating one. */
function pickNextBestFix(categories: Record<string, CategoryResult>): string | null {
  let worst: { score: number; recommendation: string } | null = null;
  for (const result of Object.values(categories)) {
    if (!result.recommendation) continue;
    if (!worst || result.score < worst.score) {
      worst = { score: result.score, recommendation: result.recommendation };
    }
  }
  return worst?.recommendation ?? null;
}

function buildDataConfidence(categories: Record<string, CategoryResult>): Record<string, DataConfidence> {
  const dataConfidence: Record<string, DataConfidence> = {};
  for (const [category, result] of Object.entries(categories)) {
    dataConfidence[category] = result.confidence;
  }
  return dataConfidence;
}

/** Computes and persists a 0-100 Local Visibility Score for a business,
 * aggregating the most recent signal from each of the 18 audit/service
 * modules into a category breakdown and a list of concrete recommendations
 * for any category scoring below RECOMMENDATION_THRESHOLD. Phase 6.1 adds
 * explainability (trend/drivers/next-best-fix/confidence) computed at write
 * time from this same data, with no new persisted columns. */
export async function computeVisibilityScore(businessId: string): Promise<VisibilityScore> {
  const { data: businessRow, error: businessError } = await supabase.from("business").select("*").eq("id", businessId).single();
  if (businessError) throw businessError;
  const business = businessRow as Business;

  const previous = await getLatestVisibilityScore(businessId);

  const signals = await fetchLatestSignals(businessId);
  const categories = await computeCategories(business, signals);

  const categoryBreakdown: Record<string, number> = {};
  const recommendations: string[] = [];
  for (const [category, result] of Object.entries(categories)) {
    categoryBreakdown[category] = result.score;
    if (result.recommendation) recommendations.push(result.recommendation);
  }

  const categoryRecommendations: Record<string, string | null> = {};
  for (const [category, result] of Object.entries(categories)) {
    categoryRecommendations[category] = result.recommendation;
  }
  await recordNextBestFixSuggestions(businessId, categoryRecommendations);

  const vertical: Vertical = business.vertical ?? "general";
  const score = weightedScore(categoryBreakdown, weightTableFor(vertical));

  const { data: inserted, error } = await supabase
    .from("visibility_score")
    .insert({
      business_id: businessId,
      score,
      category_breakdown: categoryBreakdown,
      recommendations,
    })
    .select()
    .single();
  if (error) throw error;

  const previousScore = previous?.score ?? null;

  return {
    id: inserted.id,
    business_id: businessId,
    score,
    categoryBreakdown,
    recommendations,
    computed_at: inserted.computed_at,
    previousScore,
    trend: previousScore === null ? null : score - previousScore,
    topDrivers: rankDrivers(categoryBreakdown),
    nextBestFix: pickNextBestFix(categories),
    dataConfidence: buildDataConfidence(categories),
    vertical,
    industryInsight: industryInsightFor(vertical),
  };
}

/** Returns the most recently computed score for a business, or null if none
 * yet. Phase 6.1's explainability fields are derived here too — for a
 * persisted row, drivers/confidence are recomputed from the stored breakdown
 * (dataConfidence defaults to "stale" per category since the underlying
 * signals aren't re-fetched on a plain read), and trend looks at the prior
 * row before this one. */
export async function getLatestVisibilityScore(businessId: string): Promise<VisibilityScore | null> {
  const { data, error } = await supabase
    .from("visibility_score")
    .select("*")
    .eq("business_id", businessId)
    .order("computed_at", { ascending: false })
    .limit(2);
  if (error) throw error;
  if (!data || data.length === 0) return null;

  const [latest, prior] = data;
  const categoryBreakdown: Record<string, number> = latest.category_breakdown;
  const recommendations: string[] = latest.recommendations;
  const previousScore = prior?.score ?? null;

  const { data: businessRow } = await supabase.from("business").select("vertical").eq("id", businessId).maybeSingle();
  const vertical: Vertical = (businessRow as { vertical: Vertical | null } | null)?.vertical ?? "general";

  const dataConfidence: Record<string, DataConfidence> = {};
  for (const category of Object.keys(categoryBreakdown)) {
    dataConfidence[category] = "stale";
  }

  return {
    id: latest.id,
    business_id: businessId,
    score: latest.score,
    categoryBreakdown,
    recommendations,
    computed_at: latest.computed_at,
    previousScore,
    trend: previousScore === null ? null : latest.score - previousScore,
    topDrivers: rankDrivers(categoryBreakdown),
    nextBestFix: recommendations[0] ?? null,
    dataConfidence,
    vertical,
    industryInsight: industryInsightFor(vertical),
  };
}
