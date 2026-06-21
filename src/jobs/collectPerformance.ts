import "dotenv/config";
import { supabase } from "../lib/supabase.js";
import { collectPerformance } from "../performance/index.js";
import { evaluateBoostTriggers } from "../trigger-engine/index.js";
import { postVariantBIfDue } from "../distribution/index.js";
import type { Business } from "../types.js";

async function main(): Promise<void> {
  const { data: businesses, error } = await supabase.from("business").select("*");
  if (error) throw error;

  for (const business of (businesses ?? []) as Business[]) {
    // One business throwing (e.g. a malformed row, an unexpected platform
    // value) shouldn't stop performance collection/boost evaluation for
    // every other business in this cron run.
    try {
      await postVariantBIfDue(business);
      await collectPerformance(business);
      await evaluateBoostTriggers(business);
    } catch (err) {
      console.error(`collectPerformance job failed for business ${business.id}:`, err);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
