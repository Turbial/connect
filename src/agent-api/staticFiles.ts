const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".map": "application/json; charset=utf-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

/** Phase 17: the dashboard is now a Vite-built React app whose build emits
 * content-hashed filenames under assets/ (e.g. assets/index-aB3xQ.js), so
 * there's no longer a fixed list of known filenames to map — any file vite
 * places in public/ is fair game to serve. Kept separate from server.ts so
 * it's unit-testable without disk access. */
export function contentTypeFor(path: string): string {
  const dot = path.lastIndexOf(".");
  const ext = dot === -1 ? "" : path.slice(dot);
  return CONTENT_TYPES[ext] ?? "application/octet-stream";
}

/** Maps a request path to its file name under the public/ directory, or null
 * if the path can't be a static asset (traversal attempt, empty). The
 * dashboard's client-side routing is hash-based (#/...), so the fragment
 * never reaches the server — there's no need for an SPA index.html fallback
 * for unmatched paths. */
export function staticFileFor(path: string): string | null {
  if (path === "/") return "index.html";
  if (path.includes("..")) return null;
  const trimmed = path.replace(/^\/+/, "");
  return trimmed.length > 0 ? trimmed : null;
}
