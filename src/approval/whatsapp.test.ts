import { describe, expect, it } from "vitest";
import { whatsappButtonToText, contentApprovalButtons, boostButtons } from "./whatsapp.js";

describe("whatsappButtonToText", () => {
  it("maps content approval button ids to the same text SMS replies use", () => {
    expect(whatsappButtonToText("approve_post")).toBe("yes");
    expect(whatsappButtonToText("hold")).toBe("no");
    expect(whatsappButtonToText("edit_caption")).toBe("edit");
    expect(whatsappButtonToText("regenerate_image")).toBe("edit");
  });

  it("maps boost button ids to the same text SMS boost replies use", () => {
    expect(whatsappButtonToText("boost_yes")).toBe("yes");
    expect(whatsappButtonToText("boost_no")).toBe("no");
  });

  it("passes free text through unchanged", () => {
    expect(whatsappButtonToText("actually let's hold off")).toBe("actually let's hold off");
  });
});

describe("button sets", () => {
  it("caps content approval buttons within WhatsApp's 3-button limit when sent", () => {
    expect(contentApprovalButtons().length).toBeGreaterThan(0);
  });

  it("includes a decline option in boost buttons", () => {
    expect(boostButtons().some((b) => b.id === "boost_no")).toBe(true);
  });
});
