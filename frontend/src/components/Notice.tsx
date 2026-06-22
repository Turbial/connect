/** Ported from github.com/Turbial/web-components partials/notice.hbs —
 * same data slots (title/body/destructive) as the shared Handlebars partial. */
export function Notice({ title, body, destructive }: { title: string; body?: string; destructive?: boolean }) {
  return (
    <div className={`notice${destructive ? " destructive" : ""}`} role="alert">
      <div>
        <p className="notice-title">{title}</p>
        {body && <p className="notice-body">{body}</p>}
      </div>
    </div>
  );
}
