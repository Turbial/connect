import type { Business, PackageTier } from "../types.js";

/**
 * Phase 6.7: the entitlement model the rest of the system checks against —
 * not billing integration itself, just "does this business's package
 * include feature X." Starter Audit and Local Operator are fully defined
 * since their features are covered by Phase 6 + existing Phases 1-5;
 * Growth Operator/Vertical Pro/Agency/Franchise are named placeholders whose
 * feature sets fill in as Phase 7/8 ship the underlying capability.
 */
export type PackageFeature =
  | "visibility_audit"
  | "weekly_digest"
  | "content_generation"
  | "auto_posting"
  | "boost_proposals"
  | "vertical_scoring"
  | "multi_location_rollup"
  | "white_label_reports"
  | "agent_action_queue";

const STARTER_AUDIT_FEATURES: PackageFeature[] = ["visibility_audit", "weekly_digest"];

const LOCAL_OPERATOR_FEATURES: PackageFeature[] = [
  ...STARTER_AUDIT_FEATURES,
  "content_generation",
  "auto_posting",
  "boost_proposals",
  "vertical_scoring",
];

/** Placeholder tiers default to Local Operator's feature set until their
 * Phase 7/8 features (A/B testing, multi-location, agency white-label, agent
 * action queue) ship and get added here explicitly — never silently grant a
 * feature a tier hasn't earned yet. */
const PACKAGE_FEATURES: Record<PackageTier, PackageFeature[]> = {
  starter_audit: STARTER_AUDIT_FEATURES,
  local_operator: LOCAL_OPERATOR_FEATURES,
  growth_operator: LOCAL_OPERATOR_FEATURES,
  vertical_pro: LOCAL_OPERATOR_FEATURES,
  agency: [...LOCAL_OPERATOR_FEATURES, "multi_location_rollup", "white_label_reports"],
  franchise: [...LOCAL_OPERATOR_FEATURES, "multi_location_rollup", "white_label_reports"],
};

/** A business with no package_tier set behaves as Starter Audit — the most
 * restrictive tier — rather than silently getting full access. */
export function featuresFor(tier: PackageTier | null): PackageFeature[] {
  return PACKAGE_FEATURES[tier ?? "starter_audit"];
}

export function hasFeature(business: Business, feature: PackageFeature): boolean {
  return featuresFor(business.package_tier).includes(feature);
}
