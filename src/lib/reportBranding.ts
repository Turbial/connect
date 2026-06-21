import { supabase } from "./supabase.js";
import { hasFeature } from "./packages.js";
import type { Business, Organization } from "../types.js";

export interface ReportBranding {
  logoUrl: string | null;
  primaryColor: string | null;
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Wraps a plain-text report in a minimal branded HTML shell — only ever
 * called for a business whose package tier actually has white_label_reports,
 * so an unbranded org's reports stay plain text exactly as before. */
export function buildBrandedReportHtml(reportText: string, branding: ReportBranding): string {
  const logo = branding.logoUrl ? `<img src="${escapeHtml(branding.logoUrl)}" alt="" height="40" style="display:block;margin-bottom:12px;" />` : "";
  const borderColor = branding.primaryColor ?? "#444";
  return [
    `<div style="border-top:4px solid ${escapeHtml(borderColor)};padding:16px;font-family:sans-serif;">`,
    logo,
    `<pre style="white-space:pre-wrap;font-family:inherit;">${escapeHtml(reportText)}</pre>`,
    `</div>`,
  ].join("\n");
}

/** Reports are branded at the organization level, the same scope as
 * white_label_name — an individual business under an agency doesn't set its
 * own colors. Returns null for a business with no organization or whose
 * package tier doesn't include white_label_reports. */
export async function getReportBranding(business: Business): Promise<ReportBranding | null> {
  if (!hasFeature(business, "white_label_reports") || !business.organization_id) return null;

  const { data, error } = await supabase
    .from("organization")
    .select("report_logo_url, report_primary_color")
    .eq("id", business.organization_id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  return { logoUrl: data.report_logo_url ?? null, primaryColor: data.report_primary_color ?? null };
}

export async function setReportBranding(organizationId: string, branding: ReportBranding): Promise<Organization> {
  const { data, error } = await supabase
    .from("organization")
    .update({ report_logo_url: branding.logoUrl, report_primary_color: branding.primaryColor })
    .eq("id", organizationId)
    .select()
    .single();
  if (error) throw error;
  return data as Organization;
}
