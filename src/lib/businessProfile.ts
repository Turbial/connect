import { supabase } from "./supabase.js";
import type { Business, PreferredChannel } from "../types.js";

/** Phase 6.2: the doc's §13 onboarding field list, minus fields already
 * covered by an existing column (id/created-at style bookkeeping) and minus
 * `vertical`, which Phase 6.3 introduces alongside the weight tables that
 * actually use it. Schema + types only — no UI; this is the seam a future
 * signup flow or agency console calls into. */
export interface BusinessProfileInput {
  name: string;
  serviceArea: string;
  phone: string;
  website: string | null;
  ownerMobile: string;
  ownerPreferredChannel: PreferredChannel;
  servicesOffered: string[];
  brandTone: string | null;
  bannedWords: string[];
  bannedClaims: string[];
  logoUrl: string | null;
  photoUrls: string[];
  competitorNames: string[];
  targetLocations: string[];
  postingCadence: string | null;
  complianceRestrictions: string[];
  organizationId: string | null;
}

const REQUIRED_FIELDS: (keyof BusinessProfileInput)[] = ["name", "serviceArea", "phone", "ownerMobile", "ownerPreferredChannel"];

/** Phase 6.2: the single validating intake function for a new business —
 * built once so a future signup flow or agency console has one call to make
 * instead of hand-assembling a `business` row per call site. Throws on a
 * missing required field rather than silently defaulting it, since a
 * half-described business is exactly the kind of fabricated-completeness
 * this program refuses to do. */
export async function createBusinessProfile(input: BusinessProfileInput): Promise<Business> {
  for (const field of REQUIRED_FIELDS) {
    const value = input[field];
    if (value === null || value === undefined || value === "") {
      throw new Error(`createBusinessProfile: missing required field "${field}"`);
    }
  }

  const { data: businessRow, error } = await supabase
    .from("business")
    .insert({
      name: input.name,
      service_area: input.serviceArea,
      phone: input.phone,
      website_url: input.website,
      owner_mobile: input.ownerMobile,
      owner_preferred_channel: input.ownerPreferredChannel,
      services_offered: input.servicesOffered,
      brand_tone: input.brandTone,
      brand_voice_banned_words: input.bannedWords,
      brand_voice_banned_claims: input.bannedClaims,
      logo_url: input.logoUrl,
      photo_urls: input.photoUrls,
      target_locations: input.targetLocations,
      posting_cadence: input.postingCadence,
      compliance_restrictions: input.complianceRestrictions,
      organization_id: input.organizationId,
    })
    .select()
    .single();
  if (error) throw error;
  const business = businessRow as Business;

  if (input.competitorNames.length > 0) {
    const { error: competitorError } = await supabase
      .from("competitor")
      .insert(input.competitorNames.map((name) => ({ business_id: business.id, name, gbp_place_id: null })));
    if (competitorError) throw competitorError;
  }

  return business;
}
