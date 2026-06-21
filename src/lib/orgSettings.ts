import { supabase } from "./supabase.js";
import type { Business, Organization } from "../types.js";

/** Phase 4.1: looks up the organization a business belongs to, or null if
 * the business has no organization_id (the common, unmigrated case). Lazy
 * per-call lookup keeps this additive at every existing call site rather
 * than threading an Organization through every function signature. */
export async function getOrganizationForBusiness(business: Business): Promise<Organization | null> {
  if (!business.organization_id) return null;
  const { data, error } = await supabase
    .from("organization")
    .select("*")
    .eq("id", business.organization_id)
    .maybeSingle();
  if (error) throw error;
  return (data as Organization | null) ?? null;
}

/** Phase 4.1 setting precedence: business-level override (if set) >
 * organization-level default (if set) > the hardcoded constant. One
 * resolver covers every Phase 2.4 adaptability setting since they all
 * follow the same nullable-business-column / nullable-org-column shape. */
export function resolveBusinessSetting<K extends keyof Business & keyof Organization>(
  business: Business,
  organization: Organization | null,
  key: K,
  fallback: NonNullable<Business[K]>
): NonNullable<Business[K]> {
  const businessValue = business[key];
  if (businessValue !== null && businessValue !== undefined) return businessValue as NonNullable<Business[K]>;

  const orgValue = organization?.[key as unknown as keyof Organization];
  if (orgValue !== null && orgValue !== undefined) return orgValue as unknown as NonNullable<Business[K]>;

  return fallback;
}

/** Phase 4.3 white-label: the brand name to show in owner-facing message
 * copy (approval requests, boost prompts, weekly reports) — the org's
 * white_label_name when set, otherwise the default "MightyMax". */
export function orgDisplayName(organization: Organization | null): string {
  return organization?.white_label_name ?? "MightyMax";
}

/** Phase 4.2: emergency content pause at the org level — queueWeeklyContent
 * and requestApproval skip businesses under a paused org entirely (no-op,
 * not a throw). No admin UI; this is the one exported way to flip it. */
export async function setOrgContentPause(organizationId: string, paused: boolean): Promise<void> {
  const { error } = await supabase.from("organization").update({ content_paused: paused }).eq("id", organizationId);
  if (error) throw error;
}
