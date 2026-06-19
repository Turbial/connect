import { supabase } from "../lib/supabase.js";
import { fetchGbpInsights } from "../distribution/gbp.js";
import { fetchMetaInsights } from "../distribution/meta.js";
import type { Business, Post } from "../types.js";

/** Polls per-platform insights for a business's posted items and updates stored metrics. */
export async function collectPerformance(business: Business): Promise<void> {
  const { data: itemIds, error: itemsError } = await supabase
    .from("content_item")
    .select("id")
    .eq("business_id", business.id);
  if (itemsError) throw itemsError;

  const { data: posts, error } = await supabase
    .from("post")
    .select("*")
    .not("platform_post_id", "is", null)
    .in("content_item_id", (itemIds ?? []).map((c) => c.id));
  if (error) throw error;

  for (const post of (posts ?? []) as Post[]) {
    if (!post.platform_post_id) continue;

    if (post.platform === "gbp") {
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
    } else {
      const insight = await fetchMetaInsights(business, post.platform_post_id);
      await supabase
        .from("post")
        .update({
          views: insight.views,
          clicks: insight.clicks,
          engagement: insight.engagement,
          last_polled_at: new Date().toISOString(),
        })
        .eq("id", post.id);
    }
  }
}
