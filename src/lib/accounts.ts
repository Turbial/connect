import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { supabase } from "./supabase.js";
import type { Account, AccountRole } from "../types.js";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/** scrypt with a random per-account salt, stored as "salt:hash" hex — no
 * external dependency needed since node:crypto already ships scrypt. */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}

export async function createAccount(email: string, password: string): Promise<Account> {
  if (!email || !password) throw new Error('"email" and "password" are required.');
  if (password.length < 8) throw new Error("Password must be at least 8 characters.");

  const { data, error } = await supabase
    .from("account")
    .insert({ email: email.toLowerCase(), password_hash: hashPassword(password) })
    .select()
    .single();
  if (error) throw error;
  return data as Account;
}

export async function authenticateAccount(email: string, password: string): Promise<Account | null> {
  const { data, error } = await supabase.from("account").select("*").eq("email", email.toLowerCase()).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const account = data as Account;
  return verifyPassword(password, account.password_hash) ? account : null;
}

export interface SessionToken {
  token: string;
  expiresAt: string;
}

export async function createSession(accountId: string): Promise<SessionToken> {
  const token = randomBytes32Hex();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  const { error } = await supabase.from("session").insert({ account_id: accountId, token, expires_at: expiresAt });
  if (error) throw error;
  return { token, expiresAt };
}

function randomBytes32Hex(): string {
  return randomBytes(32).toString("hex");
}

/** Resolves a bearer token to its owning account, or null if the token is
 * unknown or has expired — callers treat either case as unauthenticated. */
export async function getAccountForToken(token: string): Promise<Account | null> {
  const { data: sessionRow, error } = await supabase.from("session").select("*").eq("token", token).maybeSingle();
  if (error) throw error;
  if (!sessionRow || new Date(sessionRow.expires_at as string) <= new Date()) return null;

  const { data: accountRow, error: accountError } = await supabase
    .from("account")
    .select("*")
    .eq("id", sessionRow.account_id as string)
    .maybeSingle();
  if (accountError) throw accountError;
  return (accountRow as Account) ?? null;
}

export async function grantBusinessAccess(accountId: string, businessId: string, role: AccountRole = "owner"): Promise<void> {
  const { error } = await supabase.from("account_business").insert({ account_id: accountId, business_id: businessId, role });
  if (error) throw error;
}

export async function hasBusinessAccess(accountId: string, businessId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("account_business")
    .select("id")
    .eq("account_id", accountId)
    .eq("business_id", businessId)
    .maybeSingle();
  if (error) throw error;
  return data != null;
}
