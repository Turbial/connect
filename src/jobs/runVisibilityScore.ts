import "dotenv/config";
import { supabase } from "../lib/supabase.js";
import { computeVisibilityScore } from "../visibility-score/index.js";
import type { Business } from "../types.js";

/** Phase 3.2: computes and persists a Local Visibility Score for every
 * business, mirroring the per-business loop pattern of src/jobs/checkConnections.ts. */
async function main(): Promise<void> {
  const { data: businesses, error } = await supabase.from("business").select("*");
  if (error) throw error;

  for (const business of (businesses ?? []) as Business[]) {
    await computeVisibilityScore(business.id);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
