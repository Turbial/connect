import { supabase } from "../lib/supabase.js";
import { fetchGbpInsights } from "../distribution/gbp.js";
import type { Business, Post } from "../types.js";

/** Polls GBP Insights for a business's posted items and updates stored metrics. */
export async function collectPerformance(business: Business): Promise<void> {
  const { data: posts, error } = await supabase
    .from("post")
    .select("*")
    .eq("platform", "gbp")
    .not("platform_post_id", "is", null)
    .in(
      "content_item_id",
      (
        await supabase.from("content_item").select("id").eq("business_id", business.id)
      ).data?.map((c) => c.id) ?? []
    );
  if (error) throw error;

  for (const post of (posts ?? []) as Post[]) {
    if (!post.platform_post_id) continue;

    const insight = await fetchGbpInsights(business, post.platform_post_id);

    await supabase
      .from("post")
      .update({
        views: insight.views,
        clicks: insight.clicks,
        calls: insight.calls,
        last_polled_at: new Date().toISOString(),
      })
      .eq("id", post.id);
  }
}
