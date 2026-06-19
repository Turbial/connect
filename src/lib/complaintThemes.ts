import { supabase } from "./supabase.js";
import { callDeepSeekPrompt } from "../content-engine/generate.js";
import type { ComplaintTheme, Review } from "../types.js";

const THEMES: ComplaintTheme[] = ["slow_response", "price", "quality", "communication", "scheduling", "other"];

/** Reviews at or below this rating are the only ones worth classifying into
 * a complaint theme — matches the existing escalation threshold in
 * reach-integration/index.ts (MAX_RATING_FOR_ESCALATION). */
const NEGATIVE_REVIEW_RATING_CEILING = 3;

/** Phase 9.3: classifies a negative review's text into one of the fixed
 * complaint themes, or null when there's no text to classify, no
 * DEEPSEEK_API_KEY configured, or the model's answer doesn't match a known
 * category — same graceful-degradation pattern as classifyMessageIntent,
 * never guesses a theme. */
export async function classifyComplaintTheme(rating: number | null, text: string | null): Promise<ComplaintTheme | null> {
  if (!text || (rating ?? 0) > NEGATIVE_REVIEW_RATING_CEILING) return null;

  const result = await callDeepSeekPrompt(
    `A customer left this negative review for a local business: "${text}". Classify the complaint into exactly one of these categories: ${THEMES.join(", ")}. Respond with only the category name, nothing else.`
  );
  if (!result) return null;

  const theme = result.trim() as ComplaintTheme;
  return THEMES.includes(theme) ? theme : null;
}

/** Human-readable label for each theme, for report copy — kept here next to
 * the bounded category list so a new theme can't be added to one without
 * the other. */
export const THEME_LABELS: Record<ComplaintTheme, string> = {
  slow_response: "slow response time",
  price: "pricing",
  quality: "quality of work",
  communication: "communication",
  scheduling: "scheduling",
  other: "other issues",
};

export interface RepeatedComplaintTheme {
  theme: ComplaintTheme;
  count: number;
}

/** Default minimum occurrences before a theme is reported — a single
 * complaint is never a "pattern." */
const DEFAULT_THRESHOLD_COUNT = 3;

/** Phase 9.3: counts classified complaint themes across a business's
 * negative reviews in a time window, returning only themes that meet
 * `thresholdCount` — reviews with no classified theme are excluded rather
 * than counted as "other" by default, since a missing classification isn't
 * the same signal as an actual "other"-themed complaint. */
export async function findRepeatedComplaintThemes(
  businessId: string,
  sinceISO: string,
  thresholdCount: number = DEFAULT_THRESHOLD_COUNT
): Promise<RepeatedComplaintTheme[]> {
  const { data, error } = await supabase
    .from("review")
    .select("complaint_theme")
    .eq("business_id", businessId)
    .gte("received_at", sinceISO)
    .not("complaint_theme", "is", null);
  if (error) throw error;

  const counts = new Map<ComplaintTheme, number>();
  for (const row of (data ?? []) as Pick<Review, "complaint_theme">[]) {
    if (!row.complaint_theme) continue;
    counts.set(row.complaint_theme, (counts.get(row.complaint_theme) ?? 0) + 1);
  }

  return [...counts.entries()]
    .filter(([, count]) => count >= thresholdCount)
    .map(([theme, count]) => ({ theme, count }))
    .sort((a, b) => b.count - a.count);
}
