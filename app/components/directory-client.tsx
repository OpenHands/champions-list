"use client";

import Image from "next/image";
import { Fragment, useEffect, useMemo, useState } from "react";
import type {
  ContributorDirectoryData,
  ContributorRecord,
  RecentMergedPrRecord,
} from "@/lib/contributors";
import { formatDate } from "@/lib/contributors";

type SortKey = "login" | "name" | "first" | "recent" | "total";
type SortDirection = "asc" | "desc";

const sortColumns: Array<{ key: SortKey; label: string }> = [
  { key: "login", label: "GitHub" },
  { key: "name", label: "Name" },
  { key: "first", label: "First PR" },
  { key: "recent", label: "Most recent PR" },
  { key: "total", label: "Total merged PRs" },
];

const defaultSortDirection: Record<SortKey, SortDirection> = {
  login: "asc",
  name: "asc",
  first: "desc",
  recent: "desc",
  total: "desc",
};

function compareContributors(
  a: ContributorRecord,
  b: ContributorRecord,
  sortKey: SortKey,
  direction: SortDirection
) {
  let comparison = 0;

  if (sortKey === "login") {
    comparison = a.login.localeCompare(b.login);
  } else if (sortKey === "name") {
    comparison = (a.name || a.login).localeCompare(b.name || b.login);
  } else if (sortKey === "first") {
    comparison = new Date(a.firstMergedPr.mergedAt).getTime() - new Date(b.firstMergedPr.mergedAt).getTime();
  } else if (sortKey === "recent") {
    comparison = new Date(a.mostRecentMergedPr.mergedAt).getTime() - new Date(b.mostRecentMergedPr.mergedAt).getTime();
  } else if (sortKey === "total") {
    comparison = a.totalMergedPrs - b.totalMergedPrs;
  }

  if (comparison === 0) {
    comparison = a.login.localeCompare(b.login);
  }

  return direction === "asc" ? comparison : -comparison;
}

function matchesQuery(contributor: ContributorRecord, query: string) {
  if (!query) {
    return true;
  }

  const haystack = [
    contributor.login,
    contributor.name,
    contributor.note,
    contributor.firstMergedPr.repo,
    contributor.firstMergedPr.title,
    contributor.mostRecentMergedPr.repo,
    contributor.mostRecentMergedPr.title,
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(query.toLowerCase());
}

function duplicateTickerItems<T>(items: T[]): T[] {
  return items.length > 0 ? [...items, ...items] : [];
}

function formatUtcTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));
}

function isInteractiveTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && Boolean(target.closest("a, button, input, select, label"));
}

function SortButton({
  label,
  column,
  activeSortKey,
  activeDirection,
  onToggle,
}: {
  label: string;
  column: SortKey;
  activeSortKey: SortKey;
  activeDirection: SortDirection;
  onToggle: (key: SortKey) => void;
}) {
  const isActive = activeSortKey === column;
  const indicator = isActive ? (activeDirection === "asc" ? "↑" : "↓") : "↕";

  return (
    <button type="button" className="sort-button" onClick={() => onToggle(column)}>
      <span>{label}</span>
      <span className="sort-indicator" aria-hidden="true">
        {indicator}
      </span>
    </button>
  );
}

function AccessibilityIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="accessibility-icon">
      <circle cx="12" cy="4.5" r="2.5" fill="currentColor" />
      <path
        fill="currentColor"
        d="M18.5 8.5h-4v-1.4h-5V8.5h-4v2h4V21h2.2v-5h.8L15.6 21H18l-3.3-6.4V10.5h3.8z"
      />
    </svg>
  );
}

function TickerItemNewest({ contributor }: { contributor: ContributorRecord }) {
  return (
    <div className="ticker-chip">
      <Image
        src={contributor.avatarUrl}
        alt={`${contributor.login} avatar`}
        width={28}
        height={28}
        className="ticker-avatar"
      />
      <a href={contributor.profileUrl} target="_blank" rel="noreferrer" className="ticker-handle">
        @{contributor.login}
      </a>
      <a href={contributor.firstMergedPr.url} target="_blank" rel="noreferrer" className="ticker-pr-link">
        {contributor.firstMergedPr.repo} #{contributor.firstMergedPr.number}
      </a>
    </div>
  );
}

function TickerItemRecent({ item }: { item: RecentMergedPrRecord }) {
  return (
    <div className="ticker-chip">
      <Image src={item.avatarUrl} alt={`${item.login} avatar`} width={28} height={28} className="ticker-avatar" />
      <a href={item.profileUrl} target="_blank" rel="noreferrer" className="ticker-handle">
        @{item.login}
      </a>
      <a href={item.pullRequest.url} target="_blank" rel="noreferrer" className="ticker-pr-link">
        {item.pullRequest.repo} #{item.pullRequest.number}
      </a>
    </div>
  );
}

function ExpandedRow({ contributor }: { contributor: ContributorRecord }) {
  return (
    <div className="row-detail-panel">
      <div className="row-detail-top">
        <div className="row-detail-identity">
          <Image
            src={contributor.avatarUrl}
            alt={`${contributor.login} avatar`}
            width={56}
            height={56}
            className="detail-avatar"
          />
          <div>
            <div className="row-detail-heading">
              <span className="row-detail-handle">@{contributor.login}</span>
              {contributor.name ? <span className="row-detail-name">{contributor.name}</span> : null}
            </div>
            <div className="row-detail-meta">
              <span className="meta-chip">GitHub ID {contributor.githubUserId}</span>
              <a href={contributor.profileUrl} target="_blank" rel="noreferrer" className="meta-chip meta-chip-link">
                Open profile
              </a>
            </div>
          </div>
        </div>

        <div className="row-detail-stat">
          <span>Total merged PRs</span>
          <strong>{contributor.totalMergedPrs}</strong>
        </div>
      </div>

      <div className="row-detail-grid">
        <section className="detail-card">
          <p className="detail-eyebrow">First merged PR</p>
          <a href={contributor.firstMergedPr.url} target="_blank" rel="noreferrer" className="detail-pr-link">
            {contributor.firstMergedPr.repo} #{contributor.firstMergedPr.number}
          </a>
          <p className="detail-copy">{contributor.firstMergedPr.title}</p>
          <p className="detail-date">{formatDate(contributor.firstMergedPr.mergedAt)}</p>
        </section>

        <section className="detail-card">
          <p className="detail-eyebrow">Most recent merged PR</p>
          <a href={contributor.mostRecentMergedPr.url} target="_blank" rel="noreferrer" className="detail-pr-link">
            {contributor.mostRecentMergedPr.repo} #{contributor.mostRecentMergedPr.number}
          </a>
          <p className="detail-copy">{contributor.mostRecentMergedPr.title}</p>
          <p className="detail-date">{formatDate(contributor.mostRecentMergedPr.mergedAt)}</p>
        </section>

        <section className="detail-card detail-card-note">
          <p className="detail-eyebrow">Notes</p>
          <p className="detail-copy">
            {contributor.note || "This contributor has not added a public note yet."}
          </p>
        </section>
      </div>
    </div>
  );
}

export function DirectoryClient({ data }: { data: ContributorDirectoryData }) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("recent");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [reduceMotion, setReduceMotion] = useState(false);
  const [highContrast, setHighContrast] = useState(false);
  const [isAccessibilityOpen, setIsAccessibilityOpen] = useState(false);

  useEffect(() => {
    const storedReduceMotion = window.localStorage.getItem("champions-reduce-motion");
    const storedHighContrast = window.localStorage.getItem("champions-high-contrast");
    const prefersMoreContrast =
      window.matchMedia("(prefers-contrast: more)").matches || window.matchMedia("(forced-colors: active)").matches;

    if (storedReduceMotion === null) {
      setReduceMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    } else {
      setReduceMotion(storedReduceMotion === "true");
    }

    if (storedHighContrast === null) {
      setHighContrast(prefersMoreContrast);
    } else {
      setHighContrast(storedHighContrast === "true");
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("champions-reduce-motion", String(reduceMotion));
  }, [reduceMotion]);

  useEffect(() => {
    window.localStorage.setItem("champions-high-contrast", String(highContrast));
  }, [highContrast]);

  const filteredContributors = useMemo(() => {
    return [...data.contributors]
      .filter((contributor) => matchesQuery(contributor, query))
      .sort((a, b) => compareContributors(a, b, sortKey, sortDirection));
  }, [data.contributors, query, sortDirection, sortKey]);

  const newestTickerItems = useMemo(
    () => duplicateTickerItems(data.newestContributors.slice(0, 18)),
    [data.newestContributors]
  );
  const recentMergeTickerItems = useMemo(
    () => duplicateTickerItems(data.recentMergedPrs.slice(0, 24)),
    [data.recentMergedPrs]
  );

  const allExpanded =
    filteredContributors.length > 0 && filteredContributors.every((contributor) => expandedIds.has(contributor.githubUserId));

  function handleSort(column: SortKey) {
    if (column === sortKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(column);
    setSortDirection(defaultSortDirection[column]);
  }

  function toggleExpanded(githubUserId: string) {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(githubUserId)) {
        next.delete(githubUserId);
      } else {
        next.add(githubUserId);
      }
      return next;
    });
  }

  function expandAll() {
    setExpandedIds(new Set(filteredContributors.map((contributor) => contributor.githubUserId)));
  }

  function collapseAll() {
    setExpandedIds(new Set());
  }

  return (
    <div
      className={`directory-root${highContrast ? " high-contrast" : ""}${reduceMotion ? " reduce-motion" : ""}`}
    >
      <main className="page-shell">
        <section className="hero-card">
          <div className="hero-grid">
            <div>
              <div className="hero-badge-row">
                <p className="eyebrow">OpenHands Champions</p>
                <p className="eyebrow eyebrow-muted">Contributor directory</p>
              </div>

              <h1>The Official Directory of Codebase Contributors</h1>

              <p className="hero-copy">
                Explore all the amazing community contributors to the OpenHands projects. Any contributor with a merged
                pull request to an OpenHands’ public repository is listed below. These are verified entries using
                OpenHands.
              </p>

              <div className="hero-actions">
                <a href="#directory" className="brand-button brand-button-primary">
                  Jump to directory table
                </a>
              </div>
            </div>

            <aside className="hero-sidecard">
              <p className="hero-side-eyebrow">How This Works</p>
              <ul className="hero-list">
                <li>Newest Champions shows unique people sorted by when their first merged PR landed.</li>
                <li>Fresh Merges shows raw recent merged PR activity, even if the same person appears more than once.</li>
                <li>Click any non-link area in a row to expand details, or expand every visible contributor at once.</li>
                <li>Want to add more context, hide your name, or update your entry? Open a PR.</li>
              </ul>
              <p className="hero-side-meta">
                Last synced <strong>{data.generatedAt ? `${formatUtcTimestamp(data.generatedAt)} UTC` : "Not synced yet"}</strong>
              </p>
            </aside>
          </div>
        </section>

        <section className="stats-grid" aria-label="Directory statistics">
          <div>
            <span>Visible contributors</span>
            <strong>{data.visibleContributorCount}</strong>
          </div>
          <div>
            <span>Merged PRs tracked</span>
            <strong>{data.totalMergedPrs}</strong>
          </div>
          <div>
            <span>Public repos scanned</span>
            <strong>{data.scannedRepoCount}</strong>
          </div>
          <div>
            <span>Opt-out entries hidden</span>
            <strong>{data.hiddenContributorCount}</strong>
          </div>
        </section>

        <section className="ticker-stack">
          <div className="ticker-card" id="ticker-newest" data-motion={reduceMotion ? "paused" : "running"}>
            <div className="ticker-heading-row">
              <div>
                <p className="eyebrow eyebrow-dark">Newest Champions</p>
                <h2 className="section-title">Welcome to our first-time contributors.</h2>
              </div>
            </div>
            <div className="ticker-viewport" aria-live="off">
              <div className="ticker-track">
                {newestTickerItems.map((contributor, index) => (
                  <TickerItemNewest key={`${contributor.githubUserId}-${index}`} contributor={contributor} />
                ))}
              </div>
            </div>
          </div>

          <div className="ticker-card" data-motion={reduceMotion ? "paused" : "running"}>
            <div className="ticker-heading-row">
              <div>
                <p className="eyebrow eyebrow-dark">Fresh Merges</p>
                <h2 className="section-title">Latest Merged PRs</h2>
              </div>
            </div>
            <div className="ticker-viewport" aria-live="off">
              <div className="ticker-track ticker-track-reverse">
                {recentMergeTickerItems.map((item, index) => (
                  <TickerItemRecent
                    key={`${item.githubUserId}-${item.pullRequest.repo}-${item.pullRequest.number}-${index}`}
                    item={item}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="toolbar-card" id="directory">
          <div className="toolbar-copy">
            <p className="eyebrow eyebrow-dark">Directory</p>
            <h2 className="section-title">Official Contributor Directory</h2>
          </div>

          <div className="toolbar-controls">
            <label className="search-field">
              <span>Search directory</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by handle, name, note, or repo"
              />
            </label>

            <div className="table-actions">
              <button
                type="button"
                className="action-button"
                onClick={expandAll}
                disabled={filteredContributors.length === 0 || allExpanded}
              >
                Expand all
              </button>
              <button
                type="button"
                className="action-button action-button-secondary"
                onClick={collapseAll}
                disabled={expandedIds.size === 0}
              >
                Collapse all
              </button>
            </div>
          </div>
        </section>

        <section className="results-meta">
          <p>
            Showing <strong>{filteredContributors.length}</strong> of <strong>{data.visibleContributorCount}</strong>{" "}
            contributors.
          </p>
          <p>
            Sorted by <strong>{sortColumns.find((column) => column.key === sortKey)?.label}</strong> {sortDirection}.
          </p>
        </section>

        <section className="directory-table-card">
          <div className="table-scroll-wrap">
            <table className="directory-table">
              <thead>
                <tr>
                  {sortColumns.map((column) => (
                    <th key={column.key} scope="col">
                      <SortButton
                        label={column.label}
                        column={column.key}
                        activeSortKey={sortKey}
                        activeDirection={sortDirection}
                        onToggle={handleSort}
                      />
                    </th>
                  ))}
                  <th scope="col">
                    <span className="th-static">Details</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredContributors.length > 0 ? (
                  filteredContributors.map((contributor) => {
                    const isExpanded = expandedIds.has(contributor.githubUserId);
                    return (
                      <Fragment key={contributor.githubUserId}>
                        <tr
                          className={`directory-row${isExpanded ? " directory-row-expanded" : ""}`}
                          tabIndex={0}
                          aria-expanded={isExpanded}
                          onClick={(event) => {
                            if (isInteractiveTarget(event.target)) {
                              return;
                            }
                            toggleExpanded(contributor.githubUserId);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              toggleExpanded(contributor.githubUserId);
                            }
                          }}
                        >
                          <td>
                            <div className="identity-cell">
                              <Image
                                src={contributor.avatarUrl}
                                alt={`${contributor.login} avatar`}
                                width={32}
                                height={32}
                                className="table-avatar"
                              />
                              <span>@{contributor.login}</span>
                            </div>
                          </td>
                          <td>{contributor.name || <span className="table-muted">—</span>}</td>
                          <td>
                            <a href={contributor.firstMergedPr.url} target="_blank" rel="noreferrer" className="table-link">
                              {contributor.firstMergedPr.repo} #{contributor.firstMergedPr.number}
                            </a>
                          </td>
                          <td>
                            <a
                              href={contributor.mostRecentMergedPr.url}
                              target="_blank"
                              rel="noreferrer"
                              className="table-link"
                            >
                              {contributor.mostRecentMergedPr.repo} #{contributor.mostRecentMergedPr.number}
                            </a>
                          </td>
                          <td>{contributor.totalMergedPrs}</td>
                          <td>
                            <button
                              type="button"
                              className="row-expand-button"
                              onClick={() => toggleExpanded(contributor.githubUserId)}
                              aria-expanded={isExpanded}
                            >
                              {isExpanded ? "Collapse" : "Expand"}
                            </button>
                          </td>
                        </tr>
                        {isExpanded ? (
                          <tr className="directory-detail-row">
                            <td colSpan={6}>
                              <ExpandedRow contributor={contributor} />
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6}>
                      <div className="empty-state">
                        No contributors match your search yet. Try a different handle, repo, or note keyword.
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="cta-card" id="personalize">
          <div className="cta-grid">
            <div>
              <p className="eyebrow eyebrow-dark">Self-serve enrichment</p>
              <h2 className="section-title">Want to personalize your entry?</h2>
              <p>
                Open a PR editing <code>data/contributors.overrides.json</code> to add your full name, add a short
                note, or set <code>hidden: true</code> if you prefer not to appear in the public directory.
              </p>
            </div>

            <div className="cta-note">
              <span className="cta-note-label">Override shape</span>
              <code>{`"123456": { "name": "Ada Lovelace", "note": "Worked on docs.", "hidden": false }`}</code>
            </div>
          </div>
        </section>
      </main>

      <div className="accessibility-fab-wrap">
        <button
          type="button"
          className="accessibility-fab accessibility-icon-button"
          onClick={() => setIsAccessibilityOpen((current) => !current)}
          aria-label="Open accessibility options"
          aria-expanded={isAccessibilityOpen}
        >
          <AccessibilityIcon />
          <span className="sr-only">Accessibility options</span>
        </button>

        {isAccessibilityOpen ? (
          <div className="accessibility-panel">
            <p className="accessibility-panel-title">Accessibility options</p>
            <p className="accessibility-panel-copy">
              Motion honors reduced-motion preferences. Contrast mode increases foreground/background separation and
              removes translucent surfaces for stronger readability.
            </p>

            <label className="accessibility-toggle">
              <input
                type="checkbox"
                checked={reduceMotion}
                onChange={(event) => setReduceMotion(event.target.checked)}
              />
              <span>Pause ticker motion</span>
            </label>

            <label className="accessibility-toggle">
              <input
                type="checkbox"
                checked={highContrast}
                onChange={(event) => setHighContrast(event.target.checked)}
              />
              <span>High contrast palette</span>
            </label>
          </div>
        ) : null}
      </div>
    </div>
  );
}
