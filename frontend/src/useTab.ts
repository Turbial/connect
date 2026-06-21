import { useHashRoute, currentParams, setParam } from "./router";

/** Keeps a page's active tab mirrored into the `?tab=` hash query param,
 * so it survives refresh/back-button — consistent with this repo's
 * hash-based routing philosophy. */
export function useTab(defaultTab: string): [string, (key: string) => void] {
  // useHashRoute re-renders on every hashchange, so reading the param here
  // (rather than caching it in state) keeps this in sync with back/forward.
  useHashRoute();
  const active = currentParams().get("tab") || defaultTab;
  const setActive = (key: string) => setParam("tab", key);
  return [active, setActive];
}
