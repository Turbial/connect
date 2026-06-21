import { describe, expect, it } from "vitest";
import { parseReply } from "./sms.js";

describe("parseReply", () => {
  it("recognizes exact yes/no/edit replies", () => {
    expect(parseReply("YES")).toBe("approve");
    expect(parseReply(" y ")).toBe("approve");
    expect(parseReply("no")).toBe("reject");
    expect(parseReply("N")).toBe("reject");
    expect(parseReply("EDIT make it shorter")).toBe("edit");
  });

  it("does not misread unrelated text as a decision", () => {
    expect(parseReply("Nothing, thanks")).toBe("unknown");
    expect(parseReply("November news")).toBe("unknown");
    expect(parseReply("yeah sure")).toBe("unknown");
  });
});
