import { captureSignal } from "../shared.js";
import type { Business } from "../../types.js";

export async function runMobileFriendlinessSignal(business: Business): Promise<void> {
  const apiKey = process.env.GOOGLE_PAGESPEED_API_KEY;
  const url = (business as any).website_url as string | null;

  if (!apiKey || !url) {
    await captureSignal(business.id, "mobile-friendliness", "mobile_friendly", null);
    return;
  }

  try {
    const endpoint = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=mobile&key=${apiKey}`;
    const res = await fetch(endpoint, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) {
      await captureSignal(business.id, "mobile-friendliness", "mobile_friendly", null);
      return;
    }
    const data = await res.json() as { lighthouseResult?: { categories?: { performance?: { score?: number } } } };
    const score = data.lighthouseResult?.categories?.performance?.score;
    const normalized = score != null ? String(Math.round(score * 100)) : null;
    await captureSignal(business.id, "mobile-friendliness", "mobile_friendly", normalized);
  } catch {
    await captureSignal(business.id, "mobile-friendliness", "mobile_friendly", null);
  }
}
