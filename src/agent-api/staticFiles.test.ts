import { describe, expect, it } from "vitest";
import { contentTypeFor, staticFileFor } from "./staticFiles.js";

describe("contentTypeFor", () => {
  it("returns the right content type for html/js/css", () => {
    expect(contentTypeFor("index.html")).toBe("text/html; charset=utf-8");
    expect(contentTypeFor("assets/index-aB3xQ.js")).toBe("text/javascript; charset=utf-8");
    expect(contentTypeFor("assets/index-aB3xQ.css")).toBe("text/css; charset=utf-8");
  });

  it("falls back to a generic binary type for an unknown extension", () => {
    expect(contentTypeFor("favicon.xyz")).toBe("application/octet-stream");
  });
});

describe("staticFileFor", () => {
  it("maps / and /index.html to index.html", () => {
    expect(staticFileFor("/")).toBe("index.html");
    expect(staticFileFor("/index.html")).toBe("index.html");
  });

  it("maps any hashed build asset path under the public dir", () => {
    expect(staticFileFor("/assets/index-aB3xQ.js")).toBe("assets/index-aB3xQ.js");
    expect(staticFileFor("/styles.css")).toBe("styles.css");
  });

  it("rejects path traversal attempts", () => {
    expect(staticFileFor("/../etc/passwd")).toBeNull();
  });
});
