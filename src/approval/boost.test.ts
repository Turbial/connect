import { describe, expect, it } from "vitest";
import { clampBudget, parseBoostReply } from "./boost.js";

describe("parseBoostReply", () => {
  it("parses a plain BOOST YES/NO with no budget", () => {
    expect(parseBoostReply("BOOST YES")).toEqual({ decision: "yes", budgetCents: null });
    expect(parseBoostReply("BOOST NO")).toEqual({ decision: "no", budgetCents: null });
  });

  it("parses an owner-specified budget from a BOOST YES reply", () => {
    expect(parseBoostReply("BOOST YES $50")).toEqual({ decision: "yes", budgetCents: 5000 });
    expect(parseBoostReply("boost yes 50")).toEqual({ decision: "yes", budgetCents: 5000 });
    expect(parseBoostReply("BOOST YES $12.50")).toEqual({ decision: "yes", budgetCents: 1250 });
  });

  it("does not misread unrelated replies starting with no/n as a decline", () => {
    expect(parseBoostReply("Nothing, thanks")).toEqual({ decision: "unknown", budgetCents: null });
    expect(parseBoostReply("November news")).toEqual({ decision: "unknown", budgetCents: null });
  });

  it("returns unknown for replies that aren't boost decisions", () => {
    expect(parseBoostReply("what's this about?")).toEqual({ decision: "unknown", budgetCents: null });
  });
});

describe("clampBudget", () => {
  it("passes through a requested budget within the ceiling", () => {
    expect(clampBudget(5000, 2000)).toBe(5000);
  });

  it("clamps a requested budget above 5x the ceiling base", () => {
    expect(clampBudget(50000, 2000)).toBe(10000);
  });

  it("allows exactly the ceiling", () => {
    expect(clampBudget(10000, 2000)).toBe(10000);
  });
});
