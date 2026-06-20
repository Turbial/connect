import { describe, expect, it } from "vitest";
import { contentTypeFor, staticFileFor } from "./staticFiles.js";

describe("contentTypeFor", () => {
  it("returns the right content type for html/js/css", () => {
    expect(contentTypeFor("index.html")).toBe("text/html; charset=utf-8");
    expect(contentTypeFor("app.js")).toBe("text/javascript; charset=utf-8");
    expect(contentTypeFor("styles.css")).toBe("text/css; charset=utf-8");
  });

  it("falls back to a generic binary type for an unknown extension", () => {
    expect(contentTypeFor("favicon.ico")).toBe("application/octet-stream");
  });
});

describe("staticFileFor", () => {
  it("maps / and /index.html to index.html", () => {
    expect(staticFileFor("/")).toBe("index.html");
    expect(staticFileFor("/index.html")).toBe("index.html");
  });

  it("maps known dashboard assets", () => {
    expect(staticFileFor("/app.js")).toBe("app.js");
    expect(staticFileFor("/styles.css")).toBe("styles.css");
  });

  it("returns null for an unknown path", () => {
    expect(staticFileFor("/tools")).toBeNull();
    expect(staticFileFor("/../etc/passwd")).toBeNull();
  });
});
