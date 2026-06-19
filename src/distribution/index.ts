import { supabase } from "../lib/supabase.js";
import { postToGbp } from "./gbp.js";
import type { Business, ContentItem } from "../types.js";

/** Posts every approved content item for a business to its target platforms (GBP only in Phase 1). */
export async function postApprovedContent(business: Business): Promise<void> {
  const { data: items, error } = await supabase
    .from("content_item")
    .select("*")
    .eq("business_id", business.id)
    .eq("status", "approved");
  if (error) throw error;

  for (const item of (items ?? []) as ContentItem[]) {
    if (!item.platforms.includes("gbp")) continue;

    const result = await postToGbp(business, item);

    const { error: postError } = await supabase.from("post").insert({
      content_item_id: item.id,
      platform: "gbp",
      platform_post_id: result.platformPostId,
      posted_at: new Date().toISOString(),
    });
    if (postError) throw postError;

    await supabase.from("content_item").update({ status: "posted" }).eq("id", item.id);
  }
}
