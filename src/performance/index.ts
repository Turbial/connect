import { supabase } from "../lib/supabase.js";
import { fetchGbpInsights } from "../distribution/gbp.js";
import { fetchMetaInsights } from "../distribution/meta.js";
import { fetchPinterestInsights } from "../distribution/pinterest.js";
import { fetchTwitterInsights } from "../distribution/twitter.js";
import { fetchLinkedinInsights } from "../distribution/linkedin.js";
import { fetchThreadsInsights } from "../distribution/threads.js";
import { fetchYelpInsights } from "../distribution/yelp.js";
import { fetchNextdoorInsights } from "../distribution/nextdoor.js";
import { fetchSnapchatInsights } from "../distribution/snapchat.js";
import type { Business, Post } from "../types.js";

async function fetchInsight(business: Business, post: Post, platformPostId: string) {
  if (post.platform === "gbp") return fetchGbpInsights(business, platformPostId);
  if (post.platform === "facebook" || post.platform === "instagram") return fetchMetaInsights(business, platformPostId);
  if (post.platform === "pinterest") return fetchPinterestInsights(business, platformPostId);
  if (post.platform === "twitter") return fetchTwitterInsights(business, platformPostId);
  if (post.platform === "linkedin") return fetchLinkedinInsights(business, platformPostId);
  if (post.platform === "threads") return fetchThreadsInsights(business, platformPostId);
  if (post.platform === "yelp") return fetchYelpInsights(business, platformPostId);
  if (post.platform === "nextdoor") return fetchNextdoorInsights(business, platformPostId);
  return fetchSnapchatInsights(business, platformPostId);
}

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

    const insight = await fetchInsight(business, post, post.platform_post_id);
    await supabase
      .from("post")
      .update({
        views: insight.views,
        clicks: insight.clicks,
        calls: "calls" in insight ? insight.calls : 0,
        engagement: "engagement" in insight ? insight.engagement : 0,
        last_polled_at: new Date().toISOString(),
      })
      .eq("id", post.id);
  }
}
