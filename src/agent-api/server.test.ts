import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { stripBasePath } from "./server.js";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  delete process.env.CONNECT_BASE_PATH;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("stripBasePath", () => {
  it("is a no-op when CONNECT_BASE_PATH isn't configured", () => {
    expect(stripBasePath("/api/styles.css")).toBe("/api/styles.css");
  });

  it("strips a configured prefix from a path under it", () => {
    process.env.CONNECT_BASE_PATH = "/api";
    expect(stripBasePath("/api/styles.css")).toBe("/styles.css");
    expect(stripBasePath("/api/tools/get_operator_snapshot")).toBe("/tools/get_operator_snapshot");
  });

  it("maps the bare prefix (no trailing slash) to /", () => {
    process.env.CONNECT_BASE_PATH = "/api";
    expect(stripBasePath("/api")).toBe("/");
  });

  it("tolerates a trailing slash on the configured prefix", () => {
    process.env.CONNECT_BASE_PATH = "/api/";
    expect(stripBasePath("/api/app.js")).toBe("/app.js");
  });

  it("leaves a path outside the prefix untouched", () => {
    process.env.CONNECT_BASE_PATH = "/api";
    expect(stripBasePath("/health")).toBe("/health");
  });
});
