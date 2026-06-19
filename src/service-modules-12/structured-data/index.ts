import { captureSignal } from "../shared.js";
import type { Business } from "../../types.js";

/** Captures whether the business has the minimum fields needed to emit a
 * valid schema.org LocalBusiness structured-data block (name, address,
 * phone) — a real markup-presence crawl of the business's own site would
 * need a confirmed site URL field, not yet modeled. */
export async function runStructuredDataCheck(business: Business): Promise<void> {
  const hasMinimumFields = Boolean(business.name && business.location && business.phone);
  await captureSignal(business.id, "structured-data", "schema_org_ready", String(hasMinimumFields));
}
