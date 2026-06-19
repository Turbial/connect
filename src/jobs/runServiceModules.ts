import "dotenv/config";
import { supabase } from "../lib/supabase.js";
import { runSeoAudit } from "../seo-audit/index.js";
import { captureCompetitorSnapshots } from "../competitor-monitor/index.js";
import { syncListingInfo } from "../listings/index.js";
import type { Business } from "../types.js";

async function main(): Promise<void> {
  const { data: businesses, error } = await supabase.from("business").select("*");
  if (error) throw error;

  for (const business of (businesses ?? []) as Business[]) {
    await runSeoAudit(business);
    await captureCompetitorSnapshots(business);
    await syncListingInfo(business);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
