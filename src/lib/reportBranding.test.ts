import { describe, expect, it } from "vitest";
import { buildBrandedReportHtml } from "./reportBranding.js";

describe("buildBrandedReportHtml", () => {
  it("includes the logo and primary color when both are set", () => {
    const html = buildBrandedReportHtml("Line one", { logoUrl: "https://example.com/logo.png", primaryColor: "#112233" });
    expect(html).toContain("https://example.com/logo.png");
    expect(html).toContain("#112233");
    expect(html).toContain("Line one");
  });

  it("omits the logo image when no logoUrl is set", () => {
    const html = buildBrandedReportHtml("Line one", { logoUrl: null, primaryColor: "#112233" });
    expect(html).not.toContain("<img");
  });

  it("escapes report text so it can't inject markup", () => {
    const html = buildBrandedReportHtml('<script>alert("x")</script>', { logoUrl: null, primaryColor: null });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
