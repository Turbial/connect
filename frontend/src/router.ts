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
