const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
};

/** Phase 13: the dashboard is served as static files (no bundler), so this is
 * a pure lookup the static-file handler can use without any disk/network
 * access — kept separate from server.ts so it's unit-testable. */
export function contentTypeFor(path: string): string {
  const dot = path.lastIndexOf(".");
  const ext = dot === -1 ? "" : path.slice(dot);
  return CONTENT_TYPES[ext] ?? "application/octet-stream";
}

const STATIC_PATHS: Record<string, string> = {
  "/": "index.html",
  "/index.html": "index.html",
  "/app.js": "app.js",
  "/styles.css": "styles.css",
};

/** Maps a request path to its file name under the public/ directory, or null
 * if the path isn't one of the dashboard's known static assets. */
export function staticFileFor(path: string): string | null {
  return STATIC_PATHS[path] ?? null;
}
