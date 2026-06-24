import { captureSignal } from "../shared.js";
import type { Business } from "../../types.js";

export async function runStructuredDataCheck(business: Business): Promise<void> {
  const url = (business as any).website_url as string | null;

  if (!url) {
    const hasMinimumFields = Boolean(business.name && business.location && business.phone);
    await captureSignal(business.id, "structured-data", "schema_org_ready", String(hasMinimumFields));
    return;
  }

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10_000),
      headers: { "User-Agent": "ConnectBot/1.0 (structured-data-check)" },
    });
    if (!res.ok) {
      await captureSignal(business.id, "structured-data", "schema_org_ready", "false");
      return;
    }
    const html = await res.text();
    const hasLocalBusiness = /"@type"\s*:\s*"LocalBusiness"/i.test(html);
    await captureSignal(business.id, "structured-data", "schema_org_ready", String(hasLocalBusiness));
  } catch {
    await captureSignal(business.id, "structured-data", "schema_org_ready", "false");
  }
}
