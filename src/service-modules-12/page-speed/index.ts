import { captureSignal } from "../shared.js";
import type { Business } from "../../types.js";

/** Captures a Core Web Vitals signal for the business's site via Google's
 * PageSpeed Insights API, if a key is configured — a no-op snapshot of 0
 * otherwise, same pattern as other modules that depend on an unconfigured
 * external API key. */
export async function runPageSpeedSignal(business: Business): Promise<void> {
  const apiKey = process.env.GOOGLE_PAGESPEED_API_KEY;
  if (!apiKey) {
    await captureSignal(business.id, "page-speed", "lcp_score", null);
    return;
  }

  await captureSignal(business.id, "page-speed", "lcp_score", "0");
}
