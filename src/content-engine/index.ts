import { supabase } from "../lib/supabase.js";
import { generatePost } from "./generate.js";
import type { Business } from "../types.js";

/** Generates Phase 1's weekly batch (2-4 GBP posts) and queues them for approval. */
export async function queueWeeklyContent(business: Business, count = 3): Promise<void> {
  for (let i = 0; i < count; i++) {
    const { caption, mediaUrl } = await generatePost(business);

    const { error } = await supabase.from("content_item").insert({
      business_id: business.id,
      source: "content_engine",
      caption,
      media_url: mediaUrl,
      platforms: ["gbp"],
      status: "queued",
    });

    if (error) throw error;
  }
}
