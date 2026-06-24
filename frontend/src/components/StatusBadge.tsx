import { Tag } from "./Tag";

/** Ported from github.com/Turbial/web-components partials/status-badge.hbs —
 * same data slots (ok/label) as the shared Handlebars partial, built on top
 * of the existing Tag component instead of duplicating its pill styling. */
export function StatusBadge({ ok, label }: { ok: boolean; label?: string }) {
  return (
    <Tag variant={ok ? "ok" : "bad"}>
      <span className="status-dot" />
      {label ?? (ok ? "Operational" : "Down")}
    </Tag>
  );
}
