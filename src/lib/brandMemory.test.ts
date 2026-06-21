import { describe, expect, it } from "vitest";
import { classifyEditReply } from "./brandMemory.js";

describe("classifyEditReply", () => {
  it("returns null when no DEEPSEEK_API_KEY is configured, rather than throwing", async () => {
    const previous = process.env.DEEPSEEK_API_KEY;
    delete process.env.DEEPSEEK_API_KEY;
    try {
      const result = await classifyEditReply("Don't say 'cutting-edge' anymore, it sounds fake.");
      expect(result).toBeNull();
    } finally {
      if (previous !== undefined) process.env.DEEPSEEK_API_KEY = previous;
    }
  });
});
