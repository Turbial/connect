import type { ReactNode } from "react";

export type TagVariant = "ok" | "warn" | "bad" | "neutral";

export function Tag({ variant = "neutral", children }: { variant?: TagVariant; children: ReactNode }) {
  return <span className={`tag ${variant}`}>{children}</span>;
}
