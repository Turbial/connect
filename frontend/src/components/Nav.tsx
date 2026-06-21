import { navigate } from "../router";

const LINKS: { path: string; label: string }[] = [
  { path: "/", label: "Dashboard" },
  { path: "/content", label: "Content" },
  { path: "/boosts", label: "Boosts" },
  { path: "/competitors", label: "Competitors" },
  { path: "/rank", label: "Local rank" },
  { path: "/seo", label: "SEO" },
  { path: "/reputation", label: "Reputation" },
  { path: "/analytics", label: "Analytics" },
  { path: "/org", label: "Org & benchmark" },
  { path: "/branding", label: "Report branding" },
  { path: "/queue", label: "Action queue" },
  { path: "/credentials", label: "Platform credentials" },
];

export function Nav({ active }: { active: string }) {
  return (
    <nav className="nav">
      {LINKS.map((link) => (
        <a
          key={link.path}
          href={`#${link.path}`}
          className={active === link.path ? "active" : ""}
          onClick={(e) => {
            e.preventDefault();
            navigate(link.path);
          }}
        >
          {link.label}
        </a>
      ))}
    </nav>
  );
}
