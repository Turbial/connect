import { supabase } from "../lib/supabase.js";
import type { Business } from "../types.js";

/**
 * Listings/NAP (Name, Address, Phone) management. Pushes the business's
 * canonical NAP info out to each connected platform's profile, so a single
 * update (e.g. a phone number change) propagates everywhere instead of
 * needing to be made platform-by-platform. GBP is the first listing synced
 * here since its Business Information API surface is documented; extend
 * platform-by-platform as other platforms' business-info update APIs are
 * confirmed (most don't expose a stable one usable without partner access).
 */
const GBP_BUSINESS_INFO_ENDPOINT = (locationId: string) =>
  `https://mybusinessbusinessinformation.googleapis.com/v1/${locationId}`;

async function syncGbpListing(business: Business): Promise<{ status: "success" | "failed"; detail: string | null }> {
  if (!business.gbp_location_id || !business.gbp_access_token) {
    return { status: "failed", detail: "not connected" };
  }

  const res = await fetch(`${GBP_BUSINESS_INFO_ENDPOINT(business.gbp_location_id)}?updateMask=phoneNumbers,storefrontAddress`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${business.gbp_access_token}`,
    },
    body: JSON.stringify({
      phoneNumbers: business.phone ? { primaryPhone: business.phone } : undefined,
      storefrontAddress: business.location ? { addressLines: [business.location] } : undefined,
    }),
  });

  if (!res.ok) return { status: "failed", detail: `${res.status}` };
  return { status: "success", detail: null };
}

/** Syncs the business's NAP info across every platform with a confirmed
 * business-info update surface, logging the outcome per platform. */
export async function syncListingInfo(business: Business): Promise<void> {
  const result = await syncGbpListing(business);

  const { error } = await supabase.from("listing_sync").insert({
    business_id: business.id,
    platform: "gbp",
    status: result.status,
    detail: result.detail,
  });
  if (error) throw error;
}
