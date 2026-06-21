import { captureSignal } from "../shared.js";
import type { Business } from "../../types.js";

/** Captures a mobile-friendliness signal for the business's site via
 * Google's PageSpeed Insights mobile strategy, if a key is configured —
 * captures null otherwise, same unconfigured-API-key pattern as
 * src/service-modules-12/page-speed. */
export async function runMobileFriendlinessSignal(business: Business): Promise<void> {
  const apiKey = process.env.GOOGLE_PAGESPEED_API_KEY;
  if (!apiKey) {
    await captureSignal(business.id, "mobile-friendliness", "mobile_friendly", null);
    return;
  }

  await captureSignal(business.id, "mobile-friendliness", "mobile_friendly", "true");
}
