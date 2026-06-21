import "dotenv/config";
import { supabase } from "../lib/supabase.js";
import type { PlatformConnection } from "../types.js";

const EXPIRING_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Phase 2.2: flags platform_connection rows approaching or past token expiry,
 * so reconnection is visible before a platform silently fails mid-week. */
async function main(): Promise<void> {
  const { data: connections, error } = await supabase
    .from("platform_connection")
    .select("*")
    .not("expires_at", "is", null);
  if (error) throw error;

  const now = Date.now();

  for (const connection of (connections ?? []) as PlatformConnection[]) {
    if (connection.status === "stub") continue;
    const expiresAt = new Date(connection.expires_at!).getTime();

    let nextStatus: string | null = null;
    if (expiresAt <= now) {
      nextStatus = connection.status === "expired" ? null : "expired";
    } else if (expiresAt - now <= EXPIRING_WINDOW_MS) {
      nextStatus = connection.status === "expired" || connection.status === "expiring" ? null : "expiring";
    }

    if (!nextStatus) continue;

    const { error: updateError } = await supabase
      .from("platform_connection")
      .update({ status: nextStatus, updated_at: new Date().toISOString() })
      .eq("id", connection.id);
    if (updateError) throw updateError;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
