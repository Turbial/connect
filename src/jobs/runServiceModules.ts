import "dotenv/config";
import { supabase } from "../lib/supabase.js";
import { runSeoAudit } from "../seo-audit/index.js";
import { captureCompetitorSnapshots } from "../competitor-monitor/index.js";
import { syncListingInfo } from "../listings/index.js";
import { trackRank } from "../rank-tracker/index.js";
import { captureSentimentTrend } from "../sentiment-tracker/index.js";
import { checkDuplicateListings } from "../duplicate-listing-check/index.js";
import type { Business } from "../types.js";

async function main(): Promise<void> {
  const { data: businesses, error } = await supabase.from("business").select("*");
  if (error) throw error;

  for (const business of (businesses ?? []) as Business[]) {
    await runSeoAudit(business);
    await captureCompetitorSnapshots(business);
    await syncListingInfo(business);
    await trackRank(business, business.name);
    await captureSentimentTrend(business);
    await checkDuplicateListings(business);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
