import { captureSignal } from "../shared.js";
import type { Business } from "../../types.js";

/** Checks whether the business has any address/phone on file at all, as a
 * coarse proxy for listing-hours consistency until a real hours field and
 * per-platform hours read exist. */
export async function runBusinessHoursConsistency(business: Business): Promise<void> {
  const consistent = Boolean(business.location && business.phone);
  await captureSignal(business.id, "business-hours-consistency", "hours_profile_complete", String(consistent));
}
