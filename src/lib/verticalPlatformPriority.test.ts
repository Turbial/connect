import { describe, expect, it } from "vitest";
import { platformPriorityFor } from "./verticalPlatformPriority.js";

describe("platformPriorityFor", () => {
  it("returns the doc's named platform list per vertical", () => {
    expect(platformPriorityFor("home_services")).toContain("nextdoor");
    expect(platformPriorityFor("restaurant")).toContain("opentable");
    expect(platformPriorityFor("wellness")[0]).toBe("instagram");
  });

  it("returns an empty list for general/null, no invented priority", () => {
    expect(platformPriorityFor("general")).toEqual([]);
    expect(platformPriorityFor(null)).toEqual([]);
  });
});
