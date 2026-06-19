import { captureSignal } from "../shared.js";
import { connectedPlatforms } from "../../content-engine/index.js";
import type { Business } from "../../types.js";

/** Captures an aggregate social-follower-count snapshot across connected
 * platforms. No platform follower-count read API is confirmed yet, so this
 * captures the connected-platform count as a placeholder signal until a
 * real per-platform follower read is wired in. */
export async function runSocialFollowerCountSnapshot(business: Business): Promise<void> {
  const connectedCount = connectedPlatforms(business).length;
  await captureSignal(business.id, "social-follower-count", "connected_platform_count", String(connectedCount));
}
