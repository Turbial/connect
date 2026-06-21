import { navigate } from "../router";

const LINKS: { path: string; label: string }[] = [
  { path: "/", label: "Dashboard" },
  { path: "/content", label: "Content" },
  { path: "/growth", label: "Growth" },
  { path: "/reputation", label: "Reputation" },
  { path: "/revenue", label: "Revenue" },
  { path: "/platforms", label: "Platforms" },
  { path: "/settings", label: "Settings" },
];

export function Nav({ active }: { active: string }) {
  return (
    <nav className="nav">
      {LINKS.map((link, i) => (
        <span key={link.path} style={{ display: "flex", alignItems: "center" }}>
          {i === 1 && <span className="nav-sep" />}
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
