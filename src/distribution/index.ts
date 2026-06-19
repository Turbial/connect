import { supabase } from "../lib/supabase.js";
import { postToGbp } from "./gbp.js";
import { postToFacebookPage, postToInstagram } from "./meta.js";
import { postToPinterest } from "./pinterest.js";
import { postToTwitter } from "./twitter.js";
import { postToLinkedin } from "./linkedin.js";
import type { Business, ContentItem, Platform } from "../types.js";

async function postToPlatform(business: Business, item: ContentItem, platform: Platform) {
  if (platform === "gbp") return postToGbp(business, item);
  if (platform === "facebook") return postToFacebookPage(business, item);
  if (platform === "instagram") return postToInstagram(business, item);
  if (platform === "pinterest") return postToPinterest(business, item);
  if (platform === "twitter") return postToTwitter(business, item);
  return postToLinkedin(business, item);
}

/** Posts every approved content item for a business to its target platforms. */
export async function postApprovedContent(business: Business): Promise<void> {
  const { data: items, error } = await supabase
    .from("content_item")
    .select("*")
    .eq("business_id", business.id)
    .eq("status", "approved");
  if (error) throw error;

  for (const item of (items ?? []) as ContentItem[]) {
    for (const platform of item.platforms) {
      const result = await postToPlatform(business, item, platform);

      const { error: postError } = await supabase.from("post").insert({
        content_item_id: item.id,
        platform,
        platform_post_id: result.platformPostId,
        posted_at: new Date().toISOString(),
      });
      if (postError) throw postError;
    }

    await supabase.from("content_item").update({ status: "posted" }).eq("id", item.id);
  }
}
