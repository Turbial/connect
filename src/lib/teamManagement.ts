import { supabase } from "./supabase.js";
import { createAccount } from "./accounts.js";
import type { Account } from "../types.js";

export interface TeamMember {
  accountId: string;
  email: string;
  role: "owner" | "staff";
  joinedAt: string;
}

/** Lists every account that has access to this business, with their role. */
export async function listTeamMembers(businessId: string): Promise<TeamMember[]> {
  const { data, error } = await supabase
    .from("account_business")
    .select("account_id, role, created_at, account(email)")
    .eq("business_id", businessId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as any[]).map((row) => ({
    accountId: row.account_id as string,
    email: (row.account as { email: string } | null)?.email ?? "—",
    role: row.role as "owner" | "staff",
    joinedAt: row.created_at as string,
  }));
}

/** Adds an existing account (found by email) to this business.
 * Throws if no account with that email exists — they must sign up first. */
export async function addTeamMember(businessId: string, email: string, role: "owner" | "staff" = "staff"): Promise<void> {
  const { data: account, error: lookupErr } = await supabase
    .from("account")
    .select("id")
    .eq("email", email.toLowerCase().trim())
    .maybeSingle();
  if (lookupErr) throw lookupErr;
  if (!account) {
    throw new Error(`No account found for "${email}". They need to sign up first at the Login page.`);
  }

  const { error } = await supabase
    .from("account_business")
    .upsert({ account_id: (account as { id: string }).id, business_id: businessId, role })
    .eq("account_id", (account as { id: string }).id)
    .eq("business_id", businessId);
  if (error) throw error;
}

/** Changes the role of an existing team member. */
export async function setTeamMemberRole(businessId: string, accountId: string, role: "owner" | "staff"): Promise<void> {
  const { error } = await supabase
    .from("account_business")
    .update({ role })
    .eq("business_id", businessId)
    .eq("account_id", accountId);
  if (error) throw error;
}

/** Removes a member from a business. Does not delete their account. */
export async function removeTeamMember(businessId: string, accountId: string): Promise<void> {
  const { error } = await supabase
    .from("account_business")
    .delete()
    .eq("business_id", businessId)
    .eq("account_id", accountId);
  if (error) throw error;
}

/** Returns the role of an account for a business, or null if not a member. */
export async function getRoleForAccount(accountId: string, businessId: string): Promise<"owner" | "staff" | null> {
  const { data, error } = await supabase
    .from("account_business")
    .select("role")
    .eq("account_id", accountId)
    .eq("business_id", businessId)
    .maybeSingle();
  if (error) throw error;
  return (data?.role as "owner" | "staff" | null) ?? null;
}
