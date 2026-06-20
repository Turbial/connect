import { supabase } from "../lib/supabase.js";
import type { Business, ContentItem, MediaType, Platform, Post, Surface } from "../types.js";

/** A single posted item's metrics flattened together with the content
 * attributes that might explain those metrics, so the rest of this module
 * can reason about "why" without re-joining content_item/post every time. */
export interface ContentPerformanceEntry {
  contentItemId: string;
  postId: string;
  platform: Platform;
  variant: "a" | "b";
  mediaType: MediaType;
  surface: Surface;
  caption: string;
  postedAt: string | null;
  views: number;
  clicks: number;
  calls: number;
  engagement: number;
  impressions: number;
  shares: number;
  score: number;
}

/** Weights actions (clicks/calls/shares) above passive views/impressions,
 * since a click-through or a share is stronger evidence of resonance than a
 * view — same intuition as the boost trigger's engagement threshold. */
export function computeEngagementScore(post: Pick<Post, "views" | "clicks" | "calls" | "engagement" | "impressions" | "shares">): number {
  return post.views * 1 + post.impressions * 0.5 + post.engagement * 3 + post.clicks * 4 + post.shares * 6 + post.calls * 8;
}

function toEntry(item: ContentItem, post: Post): ContentPerformanceEntry {
  return {
    contentItemId: item.id,
    postId: post.id,
    platform: post.platform,
    variant: post.variant,
    mediaType: item.media_type,
    surface: item.surface,
    caption: post.variant === "b" && item.caption_variant_b ? item.caption_variant_b : item.caption,
    postedAt: post.posted_at,
    views: post.views,
    clicks: post.clicks,
    calls: post.calls,
    engagement: post.engagement,
    impressions: post.impressions,
    shares: post.shares,
    score: computeEngagementScore(post),
  };
}

/** Fetches every posted item for a business and ranks them by score,
 * highest first — the raw input every analysis below works from. */
export async function rankContentPerformance(businessId: string): Promise<ContentPerformanceEntry[]> {
  const { data: items, error: itemsError } = await supabase
    .from("content_item")
    .select("*")
    .eq("business_id", businessId);
  if (itemsError) throw itemsError;

  const itemById = new Map(((items ?? []) as ContentItem[]).map((item) => [item.id, item]));
  const itemIds = [...itemById.keys()];
  if (itemIds.length === 0) return [];

  const { data: posts, error: postsError } = await supabase
    .from("post")
    .select("*")
    .in("content_item_id", itemIds)
    .not("posted_at", "is", null);
  if (postsError) throw postsError;

  return ((posts ?? []) as Post[])
    .map((post) => {
      const item = itemById.get(post.content_item_id);
      return item ? toEntry(item, post) : null;
    })
    .filter((entry): entry is ContentPerformanceEntry => entry !== null)
    .sort((a, b) => b.score - a.score);
}

/** Splits ranked entries into a top and bottom group to compare, using a
 * fixed fraction of the list (clamped so small lists still get at least one
 * entry per side, and so the two groups never overlap). */
export function splitTopAndBottom(
  ranked: ContentPerformanceEntry[],
  fraction = 0.3
): { top: ContentPerformanceEntry[]; bottom: ContentPerformanceEntry[] } {
  if (ranked.length < 2) return { top: ranked, bottom: [] };

  const groupSize = Math.max(1, Math.min(Math.floor(ranked.length / 2), Math.round(ranked.length * fraction)));
  return {
    top: ranked.slice(0, groupSize),
    bottom: ranked.slice(ranked.length - groupSize),
  };
}

const EMOJI_PATTERN = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

function captionLengthBucket(caption: string): "short" | "medium" | "long" {
  if (caption.length < 80) return "short";
  if (caption.length < 200) return "medium";
  return "long";
}

function hourOfDayBucket(postedAt: string | null): "morning" | "afternoon" | "evening" | "night" | "unknown" {
  if (!postedAt) return "unknown";
  const hour = new Date(postedAt).getUTCHours();
  if (hour < 6) return "night";
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

/** A single attribute Connect checked for a correlation with performance —
 * surfaced even when not significant, so a caller can see what was ruled
 * out, not just what mattered. */
export interface PerformanceInsight {
  attribute: string;
  topValue: string;
  topShare: number;
  bottomShare: number;
  significant: boolean;
  summary: string;
}

function shareOf<T>(group: ContentPerformanceEntry[], predicate: (entry: ContentPerformanceEntry) => T): Map<T, number> {
  const counts = new Map<T, number>();
  for (const entry of group) {
    const key = predicate(entry);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const shares = new Map<T, number>();
  for (const [key, count] of counts) shares.set(key, group.length === 0 ? 0 : count / group.length);
  return shares;
}

/** Significant if the most common value among top performers shows up at
 * least 25 percentage points more often than among bottom performers — a
 * deliberately blunt threshold so guidance doesn't chase noise on small
 * sample sizes. */
const SIGNIFICANCE_THRESHOLD = 0.25;

function compareAttribute(
  attribute: string,
  top: ContentPerformanceEntry[],
  bottom: ContentPerformanceEntry[],
  predicate: (entry: ContentPerformanceEntry) => string,
  describe: (value: string) => string
): PerformanceInsight | null {
  if (top.length === 0) return null;

  const topShares = shareOf(top, predicate);
  const bottomShares = shareOf(bottom, predicate);

  let bestValue: string | null = null;
  let bestTopShare = 0;
  for (const [value, share] of topShares) {
    if (share > bestTopShare) {
      bestTopShare = share;
      bestValue = value;
    }
  }
  if (bestValue === null) return null;

  const bottomShare = bottomShares.get(bestValue) ?? 0;
  const significant = bestTopShare - bottomShare >= SIGNIFICANCE_THRESHOLD;

  return {
    attribute,
    topValue: bestValue,
    topShare: bestTopShare,
    bottomShare,
    significant,
    summary: significant
      ? `${describe(bestValue)}: ${Math.round(bestTopShare * 100)}% of top performers vs ${Math.round(bottomShare * 100)}% of underperformers.`
      : `${describe(bestValue)} shows no significant difference between top and bottom performers.`,
  };
}

/** Compares a top-performing group against an underperforming group across
 * every attribute Connect can observe about a post, so a creator (or an
 * agent acting on their behalf) can see which levers actually moved the
 * needle rather than guessing. */
export function diffAttributes(top: ContentPerformanceEntry[], bottom: ContentPerformanceEntry[]): PerformanceInsight[] {
  const checks: [string, (entry: ContentPerformanceEntry) => string, (value: string) => string][] = [
    ["media_type", (e) => e.mediaType, (v) => `${v} media`],
    ["surface", (e) => e.surface, (v) => `${v} surface`],
    ["platform", (e) => e.platform, (v) => `the ${v} platform`],
    ["variant", (e) => e.variant, (v) => `caption variant ${v.toUpperCase()}`],
    ["caption_length", (e) => captionLengthBucket(e.caption), (v) => `${v} captions`],
    ["posting_time", (e) => hourOfDayBucket(e.postedAt), (v) => `posting in the ${v}`],
    ["has_hashtags", (e) => String(e.caption.includes("#")), (v) => (v === "true" ? "using hashtags" : "not using hashtags")],
    ["has_emoji", (e) => String(EMOJI_PATTERN.test(e.caption)), (v) => (v === "true" ? "using emoji" : "not using emoji")],
  ];

  return checks
    .map(([attribute, predicate, describe]) => compareAttribute(attribute, top, bottom, predicate, describe))
    .filter((insight): insight is PerformanceInsight => insight !== null);
}

export interface ContentPerformanceAnalysis {
  topPerformers: ContentPerformanceEntry[];
  underPerformers: ContentPerformanceEntry[];
  insights: PerformanceInsight[];
  recommendation: string;
}

function buildRecommendation(insights: PerformanceInsight[], topPerformers: ContentPerformanceEntry[]): string {
  const significant = insights.filter((insight) => insight.significant);
  if (topPerformers.length === 0) {
    return "No posted content with metrics yet — once posts have views/engagement, this will identify what's working.";
  }
  if (significant.length === 0) {
    return "No single attribute clearly separates top and bottom performers yet — performance looks driven by factors outside what's tracked here (e.g. caption wording, timing of audience activity). Keep posting consistently and revisit once there's more data.";
  }
  const lines = significant.map((insight) => `Focus on ${insight.summary.split(":")[0].toLowerCase()}.`);
  return `Based on your top performers: ${lines.join(" ")}`;
}

/** The top-level "why does one post outperform another, and what should I
 * focus on next" tool — ranks everything posted, splits into top/bottom
 * groups, diffs every tracked attribute between them, and turns the
 * significant differences into plain-language guidance for the creator. */
export async function analyzeContentPerformance(business: Business): Promise<ContentPerformanceAnalysis> {
  const ranked = await rankContentPerformance(business.id);
  const { top, bottom } = splitTopAndBottom(ranked);
  const insights = diffAttributes(top, bottom);
  return {
    topPerformers: top,
    underPerformers: bottom,
    insights,
    recommendation: buildRecommendation(insights, top),
  };
}
