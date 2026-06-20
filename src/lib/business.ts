import { supabase } from "./supabase.js";
import type { Business } from "../types.js";

export interface CreateBusinessInput {
  name: string;
  location?: string;
  phone?: string;
  ownerPhone?: string;
  ownerEmail?: string;
  ownerMobile?: string;
}

/** Onboarding entry point: creates the minimal business row a brand-new
 * customer needs before anything else (platform credentials, owner
 * verification, content) can be configured — every other onboarding step
 * already operates on an existing business id, so this is the one step that
 * doesn't. `name` is the only required field; everything else can be filled
 * in later via set_platform_credentials/owner-verification. */
export async function createBusiness(input: CreateBusinessInput): Promise<Business> {
  const name = input.name?.trim();
  if (!name) throw new Error('"name" is required.');

  const { data, error } = await supabase
    .from("business")
    .insert({
      name,
      location: input.location?.trim() || null,
      phone: input.phone?.trim() || null,
      owner_phone: input.ownerPhone?.trim() || null,
      owner_email: input.ownerEmail?.trim() || null,
      owner_mobile: input.ownerMobile?.trim() || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Business;
}
