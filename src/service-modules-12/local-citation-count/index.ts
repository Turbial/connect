import { captureSignal } from "../shared.js";
import { connectedPlatforms } from "../../content-engine/index.js";
import type { Business } from "../../types.js";

/** Captures the number of connected platform listings as a proxy for local
 * citation count, since a true citation-presence crawl would need a read
 * API per directory platform (same confirmation caveat as src/seo-audit). */
export async function runLocalCitationCountSnapshot(business: Business): Promise<void> {
  const count = connectedPlatforms(business).length;
  await captureSignal(business.id, "local-citation-count", "citation_count", String(count));
}
