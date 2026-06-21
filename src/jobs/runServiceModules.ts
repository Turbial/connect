import "dotenv/config";
import { supabase } from "../lib/supabase.js";
import { runSeoAudit } from "../seo-audit/index.js";
import { captureCompetitorSnapshots } from "../competitor-monitor/index.js";
import { syncListingInfo } from "../listings/index.js";
import { trackRank } from "../rank-tracker/index.js";
import { captureSentimentTrend } from "../sentiment-tracker/index.js";
import { checkDuplicateListings } from "../duplicate-listing-check/index.js";
import { runBusinessHoursConsistency } from "../service-modules-12/business-hours-consistency/index.js";
import { runSocialProofBadgeCheck } from "../service-modules-12/social-proof-badge/index.js";
import { runStructuredDataCheck } from "../service-modules-12/structured-data/index.js";
import { runPageSpeedSignal } from "../service-modules-12/page-speed/index.js";
import { runBacklinkCountSnapshot } from "../service-modules-12/backlink-count/index.js";
import { runLocalCitationCountSnapshot } from "../service-modules-12/local-citation-count/index.js";
import { runSocialFollowerCountSnapshot } from "../service-modules-12/social-follower-count/index.js";
import { runReviewResponseRateSignal } from "../service-modules-12/review-response-rate/index.js";
import { runContentFreshnessSignal } from "../service-modules-12/content-freshness/index.js";
import { runDuplicateReviewFlagSignal } from "../service-modules-12/duplicate-review-flag/index.js";
import { runImageAltCoverageSignal } from "../service-modules-12/image-alt-coverage/index.js";
import { runMobileFriendlinessSignal } from "../service-modules-12/mobile-friendliness/index.js";
import type { Business } from "../types.js";

async function main(): Promise<void> {
  const { data: businesses, error } = await supabase.from("business").select("*");
  if (error) throw error;

  for (const business of (businesses ?? []) as Business[]) {
    try {
      await runSeoAudit(business);
      await captureCompetitorSnapshots(business);
      await syncListingInfo(business);
      await trackRank(business, business.name);
      await captureSentimentTrend(business);
      await checkDuplicateListings(business);
      await runBusinessHoursConsistency(business);
      await runSocialProofBadgeCheck(business);
      await runStructuredDataCheck(business);
      await runPageSpeedSignal(business);
      await runBacklinkCountSnapshot(business);
      await runLocalCitationCountSnapshot(business);
      await runSocialFollowerCountSnapshot(business);
      await runReviewResponseRateSignal(business);
      await runContentFreshnessSignal(business);
      await runDuplicateReviewFlagSignal(business);
      await runImageAltCoverageSignal(business);
      await runMobileFriendlinessSignal(business);
    } catch (err) {
      console.error(`runServiceModules failed for business ${business.id}:`, err);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
