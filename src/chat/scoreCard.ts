import { callTool } from "../tools/registry.js";
import type { VisibilityScore } from "../types.js";

/**
 * Phase 7.2: the "Zero-UI Dashboard" intent classifier. Deliberately limited
 * to the doc's two named intents — anything else falls through to the
 * existing approval-reply handling unchanged, not a general chatbot.
 */
export type ChatIntent = "show_score" | "whats_next";

const SHOW_SCORE_PATTERNS = [/visibility score/, /\bscore\b/, /how.*(doing|am i doing)/];
const WHATS_NEXT_PATTERNS = [/what should i fix/, /what.?s next/, /fix first/, /next best fix/];

export function classifyChatIntent(text: string): ChatIntent | null {
  const normalized = text.trim().toLowerCase();
  if (WHATS_NEXT_PATTERNS.some((p) => p.test(normalized))) return "whats_next";
  if (SHOW_SCORE_PATTERNS.some((p) => p.test(normalized))) return "show_score";
  return null;
}

/** Compact chat card: score, trend, top driver — using only Phase 6.1 data
 * already computed, no new score logic here. */
export function renderScoreCard(score: VisibilityScore): string {
  const trendLine = score.trend === null ? "" : score.trend >= 0 ? ` (+${score.trend} from last week)` : ` (${score.trend} from last week)`;
  const topDriver = score.topDrivers[0];
  const driverLine = topDriver ? `\nBiggest driver: ${topDriver.category} (${topDriver.score}/100, ${topDriver.direction})` : "";
  return `Your visibility score: ${score.score}/100${trendLine}${driverLine}`;
}

/** Estimated point impact is the gap between the worst driver's score and the
 * neutral midpoint (50) — the same "how far below neutral" framing
 * rankDrivers already uses, not a new estimate invented for chat. */
export function renderWhatsNext(score: VisibilityScore): string {
  if (!score.nextBestFix) return "Nothing urgent right now — your visibility score looks solid across the board.";
  const worstDriver = score.topDrivers.find((d) => d.direction === "negative");
  const impact = worstDriver ? Math.round(50 - worstDriver.score) : null;
  const impactLine = impact && impact > 0 ? ` Fixing this could improve your score by ${impact} points.` : "";
  return `Your biggest issue: ${score.nextBestFix}${impactLine}`;
}

/** Phase 8.10: the router's first real owner-facing trigger path — a
 * show_score/whats_next chat reply is now tool-dispatched (`get_visibility_score`)
 * instead of calling the visibility-score module directly, so this same code
 * path also produces an `agent_action` row for every chat-based score check. */
export async function buildChatIntentReply(businessId: string, intent: ChatIntent): Promise<string> {
  const result = await callTool("get_visibility_score", businessId, { source: "owner_message" });
  const score = result.status === "completed" ? (result.output as VisibilityScore | null) : null;
  if (!score) return "Your visibility score hasn't been computed yet — check back after your first audit run.";
  return intent === "show_score" ? renderScoreCard(score) : renderWhatsNext(score);
}
