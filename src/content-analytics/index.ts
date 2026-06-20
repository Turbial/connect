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

/** Every structural attribute Connect can observe about a post, shared
 * between `diffAttributes` (what separated top from bottom performers) and
 * `predictDraftScore` (does an unposted draft match the winning side) so
 * the two can never silently drift out of sync on what "media_type" or
 * "has_hashtags" actually means. `postedAt`-derived checks are excluded
 * here since an unposted draft has no `postedAt` yet — `diffAttributes`
 * adds `posting_time` on top of this shared list. */
const STRUCTURAL_CHECKS: [string, (entry: ContentPerformanceEntry) => string, (value: string) => string][] = [
  ["media_type", (e) => e.mediaType, (v) => `${v} media`],
  ["surface", (e) => e.surface, (v) => `${v} surface`],
  ["platform", (e) => e.platform, (v) => `the ${v} platform`],
  ["variant", (e) => e.variant, (v) => `caption variant ${v.toUpperCase()}`],
  ["caption_length", (e) => captionLengthBucket(e.caption), (v) => `${v} captions`],
  ["has_hashtags", (e) => String(e.caption.includes("#")), (v) => (v === "true" ? "using hashtags" : "not using hashtags")],
  ["has_emoji", (e) => String(EMOJI_PATTERN.test(e.caption)), (v) => (v === "true" ? "using emoji" : "not using emoji")],
];

/** Compares a top-performing group against an underperforming group across
 * every attribute Connect can observe about a post, so a creator (or an
 * agent acting on their behalf) can see which levers actually moved the
 * needle rather than guessing. */
export function diffAttributes(top: ContentPerformanceEntry[], bottom: ContentPerformanceEntry[]): PerformanceInsight[] {
  const checks: [string, (entry: ContentPerformanceEntry) => string, (value: string) => string][] = [
    ...STRUCTURAL_CHECKS,
    ["posting_time", (e) => hourOfDayBucket(e.postedAt), (v) => `posting in the ${v}`],
  ];

  return checks
    .map(([attribute, predicate, describe]) => compareAttribute(attribute, top, bottom, predicate, describe))
    .filter((insight): insight is PerformanceInsight => insight !== null);
}

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";

/** Same single-DeepSeek-call pattern as `content-engine/capabilities.ts` and
 * `ads/creative.ts`, reimplemented locally rather than imported — this
 * module's qualitative analysis is conceptually standalone from content
 * generation, same isolation rationale as `ads/creative.ts`'s. Returns null
 * (never throws) when no key is configured, so the free structural diff in
 * 14.1 keeps working without DeepSeek. */
async function callDeepSeek(prompt: string): Promise<string | null> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return null;

  const res = await fetch(DEEPSEEK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: "deepseek-chat", messages: [{ role: "user", content: prompt }] }),
  });
  if (!res.ok) throw new Error(`DeepSeek request failed: ${res.status}`);

  const data = (await res.json()) as { choices: { message: { content: string } }[] };
  return data.choices[0].message.content.trim();
}

interface QualitativePattern {
  pattern: string;
  explanation: string;
}

/** Strips a markdown code fence if DeepSeek wraps its JSON in one despite
 * the prompt asking for raw JSON — cheaper than a second round-trip asking
 * it to reformat. */
function extractJsonArray(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  return fenced ? fenced[1] : raw;
}

function isQualitativePattern(value: unknown): value is QualitativePattern {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as QualitativePattern).pattern === "string" &&
    typeof (value as QualitativePattern).explanation === "string"
  );
}

/** Phase 14.2: structural diffing (media type, length, hashtags...) can't
 * see *how* a caption is written — whether the top performers open with a
 * question, lead with urgency, or end on a clear CTA verb. One DeepSeek
 * call, given the actual top/bottom captions, surfaces that the same way a
 * human reading both lists side by side would. Best-effort: any failure
 * (no API key, a flaky request, unparseable output) degrades to no
 * qualitative insights rather than failing the whole analysis — the
 * structural insights from 14.1 are never blocked on this. */
export async function analyzeCaptionQualities(
  top: ContentPerformanceEntry[],
  bottom: ContentPerformanceEntry[]
): Promise<PerformanceInsight[]> {
  const topCaptions = top.map((e) => e.caption).filter(Boolean);
  const bottomCaptions = bottom.map((e) => e.caption).filter(Boolean);
  if (topCaptions.length === 0 || bottomCaptions.length === 0) return [];

  const prompt = [
    "Compare these two groups of social media captions from the same business.",
    "",
    "TOP PERFORMERS:",
    ...topCaptions.map((c, i) => `${i + 1}. ${c}`),
    "",
    "UNDERPERFORMERS:",
    ...bottomCaptions.map((c, i) => `${i + 1}. ${c}`),
    "",
    'Identify up to 3 qualitative patterns (hook style, tone, presence of a call-to-action, etc — NOT caption length or hashtag/emoji count, those are measured separately) that distinguish the top group from the underperforming group.',
    'Respond with ONLY a JSON array, each item shaped { "pattern": "short label", "explanation": "one sentence" }. If there is no clear qualitative pattern, respond with [].',
  ].join("\n");

  try {
    const raw = await callDeepSeek(prompt);
    if (!raw) return [];

    const parsed = JSON.parse(extractJsonArray(raw));
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(isQualitativePattern)
      .slice(0, 3)
      .map((item) => ({
        attribute: "caption_quality",
        topValue: item.pattern,
        topShare: 1,
        bottomShare: 0,
        significant: true,
        summary: `${item.pattern}: ${item.explanation}`,
      }));
  } catch {
    return [];
  }
}

/** A post's growth rate (score per hour) between its two most recent
 * `post_metric_snapshot` rows, and how that compares to the business's other
 * recently-snapshotted posts — the basis for flagging something climbing
 * fast while it's still climbing, rather than only after it's finished. */
export interface TrendingPost {
  postId: string;
  contentItemId: string;
  caption: string;
  currentScore: number;
  velocity: number;
  trending: boolean;
}

/** Significant if a post's velocity is at least double the business's
 * average velocity across its other recently-polled posts — same
 * deliberately-blunt-threshold philosophy as `SIGNIFICANCE_THRESHOLD`,
 * picked so a single early poll on a slow business doesn't get flagged. */
const TRENDING_VELOCITY_MULTIPLE = 2;

/** Phase 14.3: reads each post's score history (at least two
 * `post_metric_snapshot` rows, populated by `collectPerformance`'s polling
 * loop) and flags posts climbing meaningfully faster than the business's
 * own recent average — the "still rising" signal 14.1's finished-totals
 * ranking can't see. Posts with fewer than two snapshots are skipped; there
 * is no velocity to compute yet. */
export async function flagTrendingContent(businessId: string): Promise<TrendingPost[]> {
  const { data: items, error: itemsError } = await supabase
    .from("content_item")
    .select("id, caption")
    .eq("business_id", businessId);
  if (itemsError) throw itemsError;
  const captionByItemId = new Map((items ?? []).map((i) => [i.id, i.caption as string]));
  const itemIds = [...captionByItemId.keys()];
  if (itemIds.length === 0) return [];

  const { data: posts, error: postsError } = await supabase
    .from("post")
    .select("id, content_item_id")
    .in("content_item_id", itemIds);
  if (postsError) throw postsError;
  const postRows = (posts ?? []) as Pick<Post, "id" | "content_item_id">[];
  if (postRows.length === 0) return [];

  const { data: snapshots, error: snapshotError } = await supabase
    .from("post_metric_snapshot")
    .select("post_id, score, captured_at")
    .in("post_id", postRows.map((p) => p.id))
    .order("captured_at", { ascending: true });
  if (snapshotError) throw snapshotError;

  const snapshotsByPost = new Map<string, { score: number; captured_at: string }[]>();
  for (const snapshot of (snapshots ?? []) as { post_id: string; score: number; captured_at: string }[]) {
    const list = snapshotsByPost.get(snapshot.post_id) ?? [];
    list.push(snapshot);
    snapshotsByPost.set(snapshot.post_id, list);
  }

  const velocityByPost = new Map<string, number>();
  for (const post of postRows) {
    const history = snapshotsByPost.get(post.id);
    if (!history || history.length < 2) continue;

    const previous = history[history.length - 2];
    const latest = history[history.length - 1];
    const hoursElapsed = (new Date(latest.captured_at).getTime() - new Date(previous.captured_at).getTime()) / (1000 * 60 * 60);
    if (hoursElapsed <= 0) continue;

    velocityByPost.set(post.id, (latest.score - previous.score) / hoursElapsed);
  }

  if (velocityByPost.size === 0) return [];

  const averageVelocity = [...velocityByPost.values()].reduce((sum, v) => sum + v, 0) / velocityByPost.size;

  return postRows
    .filter((post) => velocityByPost.has(post.id))
    .map((post) => {
      const velocity = velocityByPost.get(post.id)!;
      const latest = snapshotsByPost.get(post.id)![snapshotsByPost.get(post.id)!.length - 1];
      return {
        postId: post.id,
        contentItemId: post.content_item_id,
        caption: captionByItemId.get(post.content_item_id) ?? "",
        currentScore: latest.score,
        velocity,
        trending: averageVelocity > 0 && velocity >= averageVelocity * TRENDING_VELOCITY_MULTIPLE,
      };
    })
    .sort((a, b) => b.velocity - a.velocity);
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
  const structuralInsights = diffAttributes(top, bottom);
  const qualitativeInsights = await analyzeCaptionQualities(top, bottom);
  const insights = [...structuralInsights, ...qualitativeInsights];
  return {
    topPerformers: top,
    underPerformers: bottom,
    insights,
    recommendation: buildRecommendation(insights, top),
  };
}

export interface DraftScorePrediction {
  score: number;
  reason: string;
}

/** A draft has no `Post` yet, so this builds just enough of a
 * `ContentPerformanceEntry` to run the same structural predicates that
 * `diffAttributes` already validated against this business's real history
 * — `platform` is the draft's first targeted platform (the attribute that
 * mattered when it was a finished post), and `postedAt`/metrics are
 * meaningless for an unposted draft and left at zero/null. */
function draftToEntry(item: ContentItem): ContentPerformanceEntry {
  return {
    contentItemId: item.id,
    postId: "",
    platform: item.platforms[0],
    variant: "a",
    mediaType: item.media_type,
    surface: item.surface,
    caption: item.caption,
    postedAt: null,
    views: 0,
    clicks: 0,
    calls: 0,
    engagement: 0,
    impressions: 0,
    shares: 0,
    score: 0,
  };
}

/** Phase 14.4: scores a queued draft against the structural attributes
 * 14.1 already found significant for this business's real posting
 * history, before the draft goes out for owner approval — advisory only,
 * consistent with every other approval flow in this codebase ("owner
 * decides", never a hard gate). Reuses `diffAttributes`'s significant
 * insights directly as the scoring weights rather than a separate model,
 * so the two can never disagree about what "worked" for this business. */
export async function predictDraftScore(business: Business, draftItem: ContentItem): Promise<DraftScorePrediction> {
  const ranked = await rankContentPerformance(business.id);
  const { top, bottom } = splitTopAndBottom(ranked);
  const significant = diffAttributes(top, bottom).filter(
    (insight) => insight.significant && insight.attribute !== "posting_time"
  );

  if (significant.length === 0) {
    return {
      score: 50,
      reason: "Not enough posting history yet to score this draft against — defaulting to a neutral score.",
    };
  }

  const draftEntry = draftToEntry(draftItem);
  const matched: string[] = [];
  const missed: string[] = [];

  for (const insight of significant) {
    const check = STRUCTURAL_CHECKS.find(([attribute]) => attribute === insight.attribute);
    if (!check) continue;
    const [, predicate] = check;
    if (predicate(draftEntry) === insight.topValue) matched.push(insight.attribute);
    else missed.push(insight.attribute);
  }

  const applicable = matched.length + missed.length;
  if (applicable === 0) {
    return {
      score: 50,
      reason: "Not enough posting history yet to score this draft against — defaulting to a neutral score.",
    };
  }

  const score = Math.round((matched.length / applicable) * 100);
  const reason =
    matched.length === 0
      ? `This draft doesn't match any of the attributes (${missed.join(", ")}) that have driven your top performers.`
      : missed.length === 0
        ? `This draft matches every attribute (${matched.join(", ")}) that has driven your top performers.`
        : `Matches ${matched.join(", ")}; doesn't match ${missed.join(", ")} — all attributes that have driven your top performers.`;

  return { score, reason };
}

/** Phase 14.5: a short style nudge (e.g. "favor video media", "Question-style
 * hooks") sourced from this business's own significant performance insights,
 * for `content-engine` to fold into its generation prompt by default rather
 * than only reporting these patterns after the fact. Best-effort: any
 * failure (no posting history yet, a transient DB error) returns null so
 * content generation is never blocked on analytics having data. */
export async function getStyleNudge(business: Business): Promise<string | null> {
  try {
    const { insights } = await analyzeContentPerformance(business);
    const significant = insights.filter((insight) => insight.significant && insight.attribute !== "posting_time");
    if (significant.length === 0) return null;
    return significant
      .slice(0, 3)
      .map((insight) => (insight.attribute === "caption_quality" ? insight.topValue : insight.summary.split(":")[0]))
      .join("; ");
  } catch {
    return null;
  }
}
