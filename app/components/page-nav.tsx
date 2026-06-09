import Link from "next/link";

type PageKind = "contributors" | "issues";

const navItems: Array<{
  key: PageKind;
  href: string;
  label: string;
  copy: string;
}> = [
  {
    key: "contributors",
    href: "/",
    label: "PR Champions",
    copy: "Merged PR contributors",
  },
  {
    key: "issues",
    href: "/issues",
    label: "Issue Champions",
    copy: "Issue creators + commenters",
  },
];

export function PageNav({ current }: { current: PageKind }) {
  return (
    <nav className="page-nav" aria-label="Champion views">
      {navItems.map((item) => {
        const isCurrent = item.key === current;

        return (
          <Link
            key={item.key}
            href={item.href}
            className={`page-nav-link${isCurrent ? " page-nav-link-current" : ""}`}
            aria-current={isCurrent ? "page" : undefined}
          >
            <span className="page-nav-label">{item.label}</span>
            <span className="page-nav-copy">{item.copy}</span>
          </Link>
        );
      })}
    </nav>
  );
}
