import { supabase } from "../lib/supabase.js";

/** Shared insert helper for Phase 12's 12 lightweight service modules, all of
 * which write into the single generic `service_signal` table instead of a
 * dedicated table each. */
export async function captureSignal(businessId: string, module: string, signal: string, value: string | null): Promise<void> {
  const { error } = await supabase.from("service_signal").insert({
    business_id: businessId,
    module,
    signal,
    value,
  });
  if (error) throw error;
}
