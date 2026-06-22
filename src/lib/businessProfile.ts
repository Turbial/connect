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

/** Every field a business profile edit is allowed to touch — deliberately
 * excludes platform credentials, verification state, and billing/package
 * fields, which have their own dedicated tools and must not be reachable
 * through a generic profile edit. */
export type BusinessProfileUpdate = Partial<{
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
  targetLocations: string[];
  complianceRestrictions: string[];
}>;

const UPDATE_FIELD_MAP: Record<keyof BusinessProfileUpdate, string> = {
  name: "name",
  serviceArea: "service_area",
  phone: "phone",
  website: "website_url",
  ownerMobile: "owner_mobile",
  ownerPreferredChannel: "owner_preferred_channel",
  servicesOffered: "services_offered",
  brandTone: "brand_tone",
  bannedWords: "brand_voice_banned_words",
  bannedClaims: "brand_voice_banned_claims",
  logoUrl: "logo_url",
  photoUrls: "photo_urls",
  targetLocations: "target_locations",
  complianceRestrictions: "compliance_restrictions",
};

/** Updates only the fields present in `update`, leaving everything else on
 * the row untouched — the counterpart to createBusinessProfile's all-fields
 * intake, for the edit path the create-only function never had. */
export async function updateBusinessProfile(businessId: string, update: BusinessProfileUpdate): Promise<Business> {
  const columns: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(update)) {
    if (value === undefined) continue;
    columns[UPDATE_FIELD_MAP[key as keyof BusinessProfileUpdate]] = value;
  }
  if (Object.keys(columns).length === 0) {
    throw new Error("updateBusinessProfile: no fields to update");
  }

  const { data, error } = await supabase.from("business").update(columns).eq("id", businessId).select().single();
  if (error) throw error;
  return data as Business;
}
