import { describe, expect, it } from "vitest";
import { safeFetch } from "./safeFetch.js";

describe("safeFetch", () => {
  it("rejects a literal loopback address", async () => {
    await expect(safeFetch("http://127.0.0.1/secret")).rejects.toThrow(/blocked address/);
  });

  it("rejects the cloud metadata address", async () => {
    await expect(safeFetch("http://169.254.169.254/latest/meta-data/")).rejects.toThrow(/blocked address/);
  });

  it("rejects a private 10.x address", async () => {
    await expect(safeFetch("http://10.0.0.5/internal")).rejects.toThrow(/blocked address/);
  });

  it("rejects a non-http(s) scheme", async () => {
    await expect(safeFetch("file:///etc/passwd")).rejects.toThrow(/non-http/);
  });
});
