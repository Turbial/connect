import { supabase } from "./supabase.js";
import type { Business, CalendarSlotStatus, ContentCalendarSlot, Platform, Surface } from "../types.js";

const DEFAULT_SLOTS_PER_WEEK = 3;

/** Parses BusinessProfile's free-text posting_cadence (Phase 6.2) into a slots-
 * per-week count. Falls back to the existing default (3) whenever the field is
 * unset or doesn't contain a parseable number, so a business that hasn't set a
 * custom cadence keeps today's exact behavior. */
export function cadenceSlotsPerWeek(business: Business): number {
  const cadence = business.posting_cadence;
  if (!cadence) return DEFAULT_SLOTS_PER_WEEK;
  const match = cadence.match(/\d+/);
  if (!match) return DEFAULT_SLOTS_PER_WEEK;
  const count = Number(match[0]);
  return count > 0 ? count : DEFAULT_SLOTS_PER_WEEK;
}

function startOfWeek(date: Date): Date {
  const result = new Date(date);
  result.setUTCHours(0, 0, 0, 0);
  result.setUTCDate(result.getUTCDate() - result.getUTCDay());
  return result;
}

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Spreads `count` slots as evenly as possible across the 7 days starting at
 * `weekStart`. */
function spreadDates(weekStart: Date, count: number): string[] {
  if (count <= 0) return [];
  const spacing = 7 / count;
  const dates: string[] = [];
  for (let i = 0; i < count; i++) {
    const date = new Date(weekStart);
    date.setUTCDate(date.getUTCDate() + Math.round(i * spacing));
    dates.push(toDateString(date));
  }
  return dates;
}

/** Plans this week's calendar slots for a business across its connected
 * platforms, using the cadence from BusinessProfile (6.2) to determine how
 * many slots per platform per week. A no-op if slots already exist for the
 * week, so calling this repeatedly within the same week never duplicates
 * plans. */
export async function planWeek(business: Business, platforms: Platform[], referenceDate = new Date()): Promise<ContentCalendarSlot[]> {
  const weekStart = startOfWeek(referenceDate);
  const weekStartStr = toDateString(weekStart);
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);
  const weekEndStr = toDateString(weekEnd);

  const { data: existing, error: existingError } = await supabase
    .from("content_calendar")
    .select("*")
    .eq("business_id", business.id)
    .gte("planned_date", weekStartStr)
    .lt("planned_date", weekEndStr);
  if (existingError) throw existingError;
  if (existing && existing.length > 0) return existing as ContentCalendarSlot[];

  const slotsPerWeek = cadenceSlotsPerWeek(business);
  const dates = spreadDates(weekStart, slotsPerWeek);

  const rows = platforms.flatMap((platform) =>
    dates.map((planned_date) => ({
      business_id: business.id,
      platform,
      surface: "feed" as Surface,
      planned_date,
      status: "planned" as CalendarSlotStatus,
    }))
  );
  if (rows.length === 0) return [];

  const { data: inserted, error } = await supabase.from("content_calendar").insert(rows).select();
  if (error) throw error;
  return (inserted ?? []) as ContentCalendarSlot[];
}

export async function getSlotsForWeek(businessId: string, referenceDate = new Date()): Promise<ContentCalendarSlot[]> {
  const weekStart = startOfWeek(referenceDate);
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);

  const { data, error } = await supabase
    .from("content_calendar")
    .select("*")
    .eq("business_id", businessId)
    .gte("planned_date", toDateString(weekStart))
    .lt("planned_date", toDateString(weekEnd));
  if (error) throw error;
  return (data ?? []) as ContentCalendarSlot[];
}

export async function markSlotStatus(slotId: string, status: CalendarSlotStatus, contentItemId?: string): Promise<void> {
  const update: { status: CalendarSlotStatus; content_item_id?: string } = { status };
  if (contentItemId) update.content_item_id = contentItemId;

  const { error } = await supabase.from("content_calendar").update(update).eq("id", slotId);
  if (error) throw error;
}
