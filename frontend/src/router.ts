import { useEffect, useState } from "react";

export function currentHash(): string {
  return window.location.hash.replace(/^#/, "") || "/";
}

/** Plain hash-based routing — no react-router dependency needed for a
 * dozen flat screens, and the hash fragment never reaches the server, so
 * the static file handler doesn't need an SPA fallback route. */
export function useHashRoute(): string {
  const [route, setRoute] = useState(currentHash());
  useEffect(() => {
    const onHashChange = () => setRoute(currentHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);
  return route;
}

export function navigate(path: string): void {
  window.location.hash = path;
}

/** Splits the current hash into its base path and a parsed query-string,
 * so tabbed pages can keep the active tab in the URL (e.g. `#/content?tab=calendar`)
 * and have it survive refresh/back-button, consistent with hash-based routing. */
export function currentPath(): string {
  return currentHash().split("?")[0] || "/";
}

export function currentParams(): URLSearchParams {
  const [, query = ""] = currentHash().split("?");
  return new URLSearchParams(query);
}

export function navigateWithParam(path: string, key: string, value: string): void {
  const params = new URLSearchParams();
  params.set(key, value);
  window.location.hash = `${path}?${params.toString()}`;
}

export function setParam(key: string, value: string): void {
  const path = currentPath();
  navigateWithParam(path, key, value);
}
