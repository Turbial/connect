import { describe, expect, it } from "vitest";
import { getToolCatalog } from "./registry.js";

describe("getToolCatalog", () => {
  it("exposes every registered tool with name/description/risk/approval only", () => {
    const catalog = getToolCatalog();
    const names = catalog.map((entry) => entry.name);

    expect(names).toContain("get_operator_snapshot");
    expect(names).toContain("run_seo_audit");
    expect(names).toContain("add_competitor");
    expect(names).toContain("capture_competitor_snapshots");
    expect(names).toContain("track_rank");
    expect(names).toContain("capture_sentiment_trend");
    expect(names).toContain("check_duplicate_listings");
    expect(names).toContain("sync_listing_info");
    expect(names).toContain("analyze_content_performance");
    expect(names).toContain("post_content_now");
    expect(names).toContain("get_boost_history");
    expect(names).toContain("get_rank_history");
    expect(names).toContain("get_seo_audit_history");
    expect(names).toContain("get_competitor_comparison");
    expect(names).toContain("get_org_visibility_rollup");
    expect(names).toContain("get_vertical_benchmark");
    expect(names).toContain("get_agent_action_queue");
    expect(names).toContain("get_report_branding");
    expect(names).toContain("set_report_branding");
    expect(names).toContain("update_business_profile");
    expect(names).toContain("set_posting_cadence");
    expect(names).toContain("send_owner_verification_code");
    expect(names).toContain("confirm_owner_verification");
    expect(names).toContain("get_inbox");
    expect(names).toContain("reply_to_customer");
    expect(names).toContain("set_autopilot");

    // Implementation details (run/preview functions) must never leak into the catalog.
    for (const entry of catalog) {
      expect(Object.keys(entry).sort()).toEqual(["approvalRequired", "description", "name", "riskLevel"]);
    }
  });

  it("has no duplicate tool names", () => {
    const names = getToolCatalog().map((entry) => entry.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
