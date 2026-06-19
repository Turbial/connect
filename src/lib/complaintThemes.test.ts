import { describe, expect, it } from "vitest";
import { classifyComplaintTheme } from "./complaintThemes.js";

describe("classifyComplaintTheme", () => {
  it("returns null for a review with no text, never fabricating a theme", async () => {
    expect(await classifyComplaintTheme(2, null)).toBeNull();
  });

  it("returns null for a positive review, even with text, since only negative reviews get themed", async () => {
    expect(await classifyComplaintTheme(5, "They were a bit slow but great work")).toBeNull();
  });

  it("returns null when no DEEPSEEK_API_KEY is configured, rather than throwing", async () => {
    const previous = process.env.DEEPSEEK_API_KEY;
    delete process.env.DEEPSEEK_API_KEY;
    try {
      const result = await classifyComplaintTheme(2, "Took three weeks to even call me back");
      expect(result).toBeNull();
    } finally {
      if (previous !== undefined) process.env.DEEPSEEK_API_KEY = previous;
    }
  });
});
