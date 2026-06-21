import { supabase } from "./supabase.js";
import type { NextBestFixTracking } from "../types.js";

/** Phase 7.7: records this computation's per-category recommendations against
 * the business's tracking rows — a category with a recommendation now is
 * (re)marked "suggested"; a category that previously had an open "suggested"
 * row but no longer has a recommendation (its score crossed back above the
 * threshold) is marked "acted_on" and resolved. No new signal sources — this
 * is bookkeeping on top of the score's existing per-category recommendations. */
export async function recordNextBestFixSuggestions(businessId: string, categoryRecommendations: Record<string, string | null>): Promise<void> {
  const { data: existing, error } = await supabase.from("next_best_fix").select("*").eq("business_id", businessId);
  if (error) throw error;
  const existingByCategory = new Map(((existing ?? []) as NextBestFixTracking[]).map((row) => [row.category, row]));

  for (const [category, recommendation] of Object.entries(categoryRecommendations)) {
    const row = existingByCategory.get(category);

    if (recommendation) {
      if (!row || row.status !== "suggested" || row.recommendation !== recommendation) {
        const { error: upsertError } = await supabase.from("next_best_fix").upsert(
          {
            business_id: businessId,
            category,
            recommendation,
            status: "suggested",
            first_suggested_at: row?.status === "suggested" ? row.first_suggested_at : new Date().toISOString(),
            resolved_at: null,
          },
          { onConflict: "business_id,category" }
        );
        if (upsertError) throw upsertError;
      }
    } else if (row && row.status === "suggested") {
      const { error: resolveError } = await supabase
        .from("next_best_fix")
        .update({ status: "acted_on", resolved_at: new Date().toISOString() })
        .eq("id", row.id);
      if (resolveError) throw resolveError;
    }
  }
}

/** Fixes resolved within the last `sinceDays` days, for the weekly
 * digest/chat card to acknowledge instead of staying silent about progress. */
export async function getRecentlyResolvedFixes(businessId: string, sinceDays = 7): Promise<NextBestFixTracking[]> {
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("next_best_fix")
    .select("*")
    .eq("business_id", businessId)
    .eq("status", "acted_on")
    .gte("resolved_at", since);
  if (error) throw error;
  return (data ?? []) as NextBestFixTracking[];
}
