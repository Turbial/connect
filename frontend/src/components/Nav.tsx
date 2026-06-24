import { navigate } from "../router";

const LINKS: { path: string; label: string }[] = [
  { path: "/", label: "Dashboard" },
  { path: "/inbox", label: "Inbox" },
  { path: "/content", label: "Content" },
  { path: "/growth", label: "Growth" },
  { path: "/reputation", label: "Reputation" },
  { path: "/revenue", label: "Revenue" },
  { path: "/platforms", label: "Platforms" },
  { path: "/settings", label: "Settings" },
  { path: "/billing", label: "Billing" },
  { path: "/support", label: "Support" },
];

export function Nav({ active }: { active: string }) {
  return (
    <nav className="nav">
      {LINKS.map((link, i) => (
        <span key={link.path} style={{ display: "flex", alignItems: "center" }}>
          {(i === 2 || i === 8) && <span className="nav-sep" />}
          <a
            href={`#${link.path}`}
            className={active === link.path ? "active" : ""}
            onClick={(e) => {
              e.preventDefault();
              navigate(link.path);
            }}
          >
            {link.label}
          </a>
        </span>
      ))}
    </nav>
  );
}
