import { captureSignal } from "../shared.js";
import type { Business } from "../../types.js";

/** Captures a backlink-count snapshot for the business — a real count needs
 * a confirmed backlink-data provider (Ahrefs/Moz/Semrush API), not yet
 * wired; captures null until that provider integration is confirmed. */
export async function runBacklinkCountSnapshot(business: Business): Promise<void> {
  await captureSignal(business.id, "backlink-count", "backlink_count", null);
}
