import { describe, expect, it } from "vitest";
import { surfaceFor } from "./generate.js";

describe("surfaceFor", () => {
  it("lets Instagram target story or reel distinctly from feed", () => {
    expect(surfaceFor("instagram", "image", "story")).toBe("story");
    expect(surfaceFor("instagram", "video", "reel")).toBe("reel");
    expect(surfaceFor("instagram", "image")).toBe("feed");
  });

  it("ignores a requested surface the platform doesn't distinguish", () => {
    expect(surfaceFor("instagram", "image", "short")).toBe("feed");
  });

  it("defaults YouTube to video, not short, unless requested", () => {
    expect(surfaceFor("youtube", "video")).toBe("video");
    expect(surfaceFor("youtube", "video", "short")).toBe("short");
  });

  it("leaves single-surface platforms on the plain image/video fallback", () => {
    expect(surfaceFor("gbp", "image")).toBe("feed");
    expect(surfaceFor("tiktok", "video")).toBe("video");
  });
});
