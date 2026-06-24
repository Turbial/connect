import type { ReactNode } from "react";

export function Card({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="card">
      <div style={{ marginBottom: "0.9rem" }}>
        <h2>{title}</h2>
        {hint && <p className="muted" style={{ margin: 0, marginTop: "0.2rem" }}>{hint}</p>}
      </div>
      {children}
    </section>
  );
}
