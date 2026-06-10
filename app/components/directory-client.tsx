"use client";

import Image from "next/image";
import { Fragment, useEffect, useMemo, useState } from "react";
import { AccessibilityControls } from "@/app/components/accessibility-controls";
import { PageNav } from "@/app/components/page-nav";
import type {
  ContributorDirectoryData,
  ContributorRecord,
  RecentMergedPrRecord,
} from "@/lib/contributors";
import { formatDate, getContributorYearStats, mergedPrYear } from "@/lib/contributors";

type SortKey = "login" | "name" | "first" | "recent" | "total";
type SortDirection = "asc" | "desc";

const sortColumns: Array<{ key: SortKey; label: string }> = [
  { key: "login", label: "GitHub" },
  { key: "name", label: "Name" },
  { key: "first", label: "First PR" },
  { key: "recent", label: "Most recent PR" },
  { key: "total", label: "Merged PRs" },
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
  direction: SortDirection,
  selectedYear: string
) {
  const aStats = getContributorYearStats(a, selectedYear);
  const bStats = getContributorYearStats(b, selectedYear);

  if (!aStats || !bStats) {
    return a.login.localeCompare(b.login);
  }

  let comparison = 0;

  if (sortKey === "login") {
    comparison = a.login.localeCompare(b.login);
  } else if (sortKey === "name") {
    comparison = (a.name || a.login).localeCompare(b.name || b.login);
  } else if (sortKey === "first") {
    comparison = new Date(aStats.firstMergedPr.mergedAt).getTime() - new Date(bStats.firstMergedPr.mergedAt).getTime();
  } else if (sortKey === "recent") {
    comparison =
      new Date(aStats.mostRecentMergedPr.mergedAt).getTime() - new Date(bStats.mostRecentMergedPr.mergedAt).getTime();
  } else if (sortKey === "total") {
    comparison = aStats.totalMergedPrs - bStats.totalMergedPrs;
  }

  if (comparison === 0) {
    comparison = a.login.localeCompare(b.login);
  }

  return direction === "asc" ? comparison : -comparison;
}

function matchesQuery(contributor: ContributorRecord, query: string, selectedYear: string) {
  if (!query) {
    return true;
  }

  const yearStats = getContributorYearStats(contributor, selectedYear);
  const haystack = [
    contributor.login,
    contributor.name,
    contributor.note,
    selectedYear,
    contributor.contributionYears.join(" "),
    yearStats?.firstMergedPr.repo,
    yearStats?.firstMergedPr.title,
    yearStats?.mostRecentMergedPr.repo,
    yearStats?.mostRecentMergedPr.title,
  ]
    .filter(Boolean)
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

function TickerItemSeason({ contributor, selectedYear }: { contributor: ContributorRecord; selectedYear: string }) {
  const yearStats = getContributorYearStats(contributor, selectedYear);

  if (!yearStats) {
    return null;
  }

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
      <a href={yearStats.firstMergedPr.url} target="_blank" rel="noreferrer" className="ticker-pr-link">
        {yearStats.firstMergedPr.repo} #{yearStats.firstMergedPr.number}
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

function ExpandedRow({ contributor, selectedYear }: { contributor: ContributorRecord; selectedYear: string }) {
  const yearStats = getContributorYearStats(contributor, selectedYear);

  if (!yearStats) {
    return null;
  }

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
              <span className="meta-chip">Lifetime merged PRs {contributor.totalMergedPrs}</span>
              {contributor.contributionYears.map((year) => (
                <span
                  key={`${contributor.githubUserId}-${year}`}
                  className={`meta-chip${year === selectedYear ? " meta-chip-active" : ""}`}
                >
                  {year === selectedYear ? `${year} season` : year}
                </span>
              ))}
              <a href={contributor.profileUrl} target="_blank" rel="noreferrer" className="meta-chip meta-chip-link">
                Open profile
              </a>
            </div>
          </div>
        </div>

        <div className="row-detail-stat">
          <span>Merged PRs in {selectedYear}</span>
          <strong>{yearStats.totalMergedPrs}</strong>
        </div>
      </div>

      <div className="row-detail-grid">
        <section className="detail-card">
          <p className="detail-eyebrow">First merged PR in {selectedYear}</p>
          <a href={yearStats.firstMergedPr.url} target="_blank" rel="noreferrer" className="detail-pr-link">
            {yearStats.firstMergedPr.repo} #{yearStats.firstMergedPr.number}
          </a>
          <p className="detail-copy">{yearStats.firstMergedPr.title}</p>
          <p className="detail-date">{formatDate(yearStats.firstMergedPr.mergedAt)}</p>
        </section>

        <section className="detail-card">
          <p className="detail-eyebrow">Most recent merged PR in {selectedYear}</p>
          <a href={yearStats.mostRecentMergedPr.url} target="_blank" rel="noreferrer" className="detail-pr-link">
            {yearStats.mostRecentMergedPr.repo} #{yearStats.mostRecentMergedPr.number}
          </a>
          <p className="detail-copy">{yearStats.mostRecentMergedPr.title}</p>
          <p className="detail-date">{formatDate(yearStats.mostRecentMergedPr.mergedAt)}</p>
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
  const [selectedYear, setSelectedYear] = useState(data.availableYears[0] ?? "");
  const [sortKey, setSortKey] = useState<SortKey>("recent");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [reduceMotion, setReduceMotion] = useState(false);
  const [highContrast, setHighContrast] = useState(false);
  const [isAccessibilityOpen, setIsAccessibilityOpen] = useState(false);

  const pageSizeOptions = [20, 50, 100, 200] as const;
  const [pageSize, setPageSize] = useState<(typeof pageSizeOptions)[number]>(20);
  const [page, setPage] = useState(1);

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
    if (selectedYear || data.availableYears.length === 0) {
      return;
    }

    setSelectedYear(data.availableYears[0]);
  }, [data.availableYears, selectedYear]);

  useEffect(() => {
    window.localStorage.setItem("champions-reduce-motion", String(reduceMotion));
  }, [reduceMotion]);

  useEffect(() => {
    window.localStorage.setItem("champions-high-contrast", String(highContrast));
  }, [highContrast]);

  const contributorsForYear = useMemo(() => {
    return data.contributors.filter((contributor) => Boolean(getContributorYearStats(contributor, selectedYear)));
  }, [data.contributors, selectedYear]);

  const filteredContributors = useMemo(() => {
    return [...contributorsForYear]
      .filter((contributor) => matchesQuery(contributor, query, selectedYear))
      .sort((a, b) => compareContributors(a, b, sortKey, sortDirection, selectedYear));
  }, [contributorsForYear, query, selectedYear, sortDirection, sortKey]);

  const pageCount = Math.max(1, Math.ceil(filteredContributors.length / pageSize));

  useEffect(() => {
    setPage(1);
  }, [pageSize, query, selectedYear, sortDirection, sortKey]);

  useEffect(() => {
    setExpandedIds(new Set());
  }, [selectedYear]);

  useEffect(() => {
    if (page > pageCount) {
      setPage(pageCount);
    }
  }, [page, pageCount]);

  const pageStartIndex = (page - 1) * pageSize;
  const pageEndIndex = Math.min(pageStartIndex + pageSize, filteredContributors.length);
  const paginatedContributors = useMemo(() => {
    return filteredContributors.slice(pageStartIndex, pageEndIndex);
  }, [filteredContributors, pageEndIndex, pageStartIndex]);

  const showingStart = filteredContributors.length === 0 ? 0 : pageStartIndex + 1;
  const showingEnd = pageEndIndex;

  const seasonTickerItems = useMemo(() => {
    const seasonContributors = [...contributorsForYear].sort((a, b) => {
      const aStats = getContributorYearStats(a, selectedYear);
      const bStats = getContributorYearStats(b, selectedYear);

      if (!aStats || !bStats) {
        return a.login.localeCompare(b.login);
      }

      return (
        new Date(aStats.firstMergedPr.mergedAt).getTime() - new Date(bStats.firstMergedPr.mergedAt).getTime() ||
        new Date(bStats.mostRecentMergedPr.mergedAt).getTime() - new Date(aStats.mostRecentMergedPr.mergedAt).getTime() ||
        a.login.localeCompare(b.login)
      );
    });

    return duplicateTickerItems(seasonContributors.slice(0, 18));
  }, [contributorsForYear, selectedYear]);

  const recentMergeTickerItems = useMemo(() => {
    return duplicateTickerItems(
      data.recentMergedPrs.filter((item) => mergedPrYear(item.pullRequest.mergedAt) === selectedYear).slice(0, 24)
    );
  }, [data.recentMergedPrs, selectedYear]);

  const selectedYearMergedPrs = useMemo(() => {
    return contributorsForYear.reduce(
      (total, contributor) => total + (getContributorYearStats(contributor, selectedYear)?.totalMergedPrs ?? 0),
      0
    );
  }, [contributorsForYear, selectedYear]);

  const latestTrackedYear = data.availableYears[0] ?? null;
  const oldestTrackedYear = data.availableYears.length > 0 ? data.availableYears[data.availableYears.length - 1] : null;
  const allExpanded =
    paginatedContributors.length > 0 && paginatedContributors.every((contributor) => expandedIds.has(contributor.githubUserId));

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
    setExpandedIds((current) => {
      const next = new Set(current);
      paginatedContributors.forEach((contributor) => next.add(contributor.githubUserId));
      return next;
    });
  }

  function collapseAll() {
    setExpandedIds(new Set());
  }

  return (
    <div
      className={`directory-root${highContrast ? " high-contrast" : ""}${reduceMotion ? " reduce-motion" : ""}`}
    >
      <main className="page-shell">
        <PageNav current="contributors" />

        <section className="hero-card">
          <div className="hero-grid">
            <div>
              <div className="hero-badge-row">
                <p className="eyebrow">OpenHands Champions</p>
                <p className="eyebrow eyebrow-muted">Contributor directory</p>
              </div>

              <h1>The Official Directory of Codebase Contributors</h1>

              <p className="hero-copy">
                Every calendar year is its own champion season. Pick a year to see who landed merged PRs in that season,
                then expand a row to see every season a contributor has renewed their status.
              </p>

              <div className="hero-actions">
                <a href="#directory" className="brand-button brand-button-primary">
                  Jump to directory table
                </a>
                <a href="/issues" className="brand-button brand-button-secondary">
                  View Issue Champions
                </a>
              </div>
            </div>

            <aside className="hero-sidecard">
              <p className="hero-side-eyebrow">How This Works</p>
              <ul className="hero-list">
                <li>Use the Champion season filter to treat each year as a fresh leaderboard.</li>
                <li>Season Openers shows the earliest merged PRs from the selected season.</li>
                <li>Fresh Merges shows raw merged PR activity from that same season.</li>
                <li>Expanded rows reveal every year a contributor has come back and contributed.</li>
                <li>
                  Want to add more context, hide your name, or update your entry? Open a PR in this repo: {" "}
                  <a href="https://github.com/OpenHands/champions-list" target="_blank" rel="noreferrer">
                    OpenHands/champions-list
                  </a>
                  .
                </li>
              </ul>
              <p className="hero-side-meta">
                Last synced <strong>{data.generatedAt ? `${formatUtcTimestamp(data.generatedAt)} UTC` : "Not synced yet"}</strong>
              </p>
              <p className="hero-side-meta">
                Seasons tracked <strong>{latestTrackedYear && oldestTrackedYear ? `${oldestTrackedYear} → ${latestTrackedYear}` : "Sync pending"}</strong>
              </p>
            </aside>
          </div>
        </section>

        <section className="stats-grid" aria-label="Directory statistics">
          <div>
            <span>{selectedYear || "Current"} champions</span>
            <strong>{contributorsForYear.length}</strong>
          </div>
          <div>
            <span>Merged PRs in {selectedYear || "season"}</span>
            <strong>{selectedYearMergedPrs}</strong>
          </div>
          <div>
            <span>Champion seasons tracked</span>
            <strong>{data.availableYears.length}</strong>
          </div>
          <div>
            <span>Public repos scanned</span>
            <strong>{data.scannedRepoCount}</strong>
          </div>
        </section>

        <section className="ticker-stack">
          <div className="ticker-card" id="ticker-newest" data-motion={reduceMotion ? "paused" : "running"}>
            <div className="ticker-heading-row">
              <div>
                <p className="eyebrow eyebrow-dark">Season Openers</p>
                <h2 className="section-title">Earliest merged PRs from {selectedYear || "this season"}</h2>
              </div>
            </div>
            <div className="ticker-viewport" aria-live="off">
              <div className="ticker-track">
                {seasonTickerItems.map((contributor, index) => (
                  <TickerItemSeason
                    key={`${contributor.githubUserId}-${selectedYear}-${index}`}
                    contributor={contributor}
                    selectedYear={selectedYear}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="ticker-card" data-motion={reduceMotion ? "paused" : "running"}>
            <div className="ticker-heading-row">
              <div>
                <p className="eyebrow eyebrow-dark">Fresh Merges</p>
                <h2 className="section-title">Latest merged PRs from {selectedYear || "the selected season"}</h2>
              </div>
            </div>
            <div className="ticker-viewport" aria-live="off">
              <div className="ticker-track ticker-track-reverse">
                {recentMergeTickerItems.map((item, index) => (
                  <TickerItemRecent
                    key={`${item.githubUserId}-${item.pullRequest.repo}-${item.pullRequest.number}-${selectedYear}-${index}`}
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
            <h2 className="section-title">Official Contributor Directory — {selectedYear || "Season"}</h2>
            <p className="toolbar-note">
              Each season is a new shot at champion status. Filter by year to focus on that class, then expand any row
              to see the full set of years a contributor has shown up.
            </p>
          </div>

          <div className="toolbar-controls">
            <div className="toolbar-filter-grid">
              <label className="search-field">
                <span>Search directory</span>
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search by handle, name, note, or repo"
                />
              </label>

              <label className="search-field">
                <span>Champion season</span>
                <select value={selectedYear} onChange={(event) => setSelectedYear(event.target.value)}>
                  {data.availableYears.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="table-actions">
              <button
                type="button"
                className="action-button"
                onClick={expandAll}
                disabled={paginatedContributors.length === 0 || allExpanded}
              >
                Expand page
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
            Showing <strong>{showingStart}</strong>–<strong>{showingEnd}</strong> of <strong>{filteredContributors.length}</strong>{" "}
            {query ? "matching " : ""}contributors in <strong>{selectedYear || "the selected season"}</strong>. <strong>{data.hiddenContributorCount}</strong>{" "}
            hidden overall.
          </p>
          <p>
            Sorted by <strong>{sortColumns.find((column) => column.key === sortKey)?.label}</strong> {sortDirection}.
          </p>
        </section>

        {filteredContributors.length > 0 ? (
          <section className="pagination-bar" aria-label="Pagination controls">
            <label className="pagination-field">
              <span>Rows per page</span>
              <select
                value={pageSize}
                onChange={(event) => setPageSize(Number(event.target.value) as (typeof pageSizeOptions)[number])}
              >
                {pageSizeOptions.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>

            <div className="pagination-controls">
              <button
                type="button"
                className="action-button action-button-secondary pagination-button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1}
              >
                Prev
              </button>

              <label className="pagination-field pagination-field-page">
                <span>Page</span>
                <select value={page} onChange={(event) => setPage(Number(event.target.value))}>
                  {Array.from({ length: pageCount }, (_, index) => index + 1).map((pageNumber) => (
                    <option key={pageNumber} value={pageNumber}>
                      {pageNumber}
                    </option>
                  ))}
                </select>
              </label>

              <span className="pagination-of">of {pageCount}</span>

              <button
                type="button"
                className="action-button action-button-secondary pagination-button"
                onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
                disabled={page >= pageCount}
              >
                Next
              </button>
            </div>
          </section>
        ) : null}

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
                  paginatedContributors.map((contributor) => {
                    const isExpanded = expandedIds.has(contributor.githubUserId);
                    const yearStats = getContributorYearStats(contributor, selectedYear);

                    if (!yearStats) {
                      return null;
                    }

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
                            <a href={yearStats.firstMergedPr.url} target="_blank" rel="noreferrer" className="table-link">
                              {yearStats.firstMergedPr.repo} #{yearStats.firstMergedPr.number}
                            </a>
                          </td>
                          <td>
                            <a href={yearStats.mostRecentMergedPr.url} target="_blank" rel="noreferrer" className="table-link">
                              {yearStats.mostRecentMergedPr.repo} #{yearStats.mostRecentMergedPr.number}
                            </a>
                          </td>
                          <td>{yearStats.totalMergedPrs}</td>
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
                              <ExpandedRow contributor={contributor} selectedYear={selectedYear} />
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
                        No contributors match your search for the {selectedYear || "selected"} season yet. Try a different handle,
                        repo, or note keyword.
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

      <AccessibilityControls
        reduceMotion={reduceMotion}
        highContrast={highContrast}
        isOpen={isAccessibilityOpen}
        onToggleOpen={() => setIsAccessibilityOpen((current) => !current)}
        onClose={() => setIsAccessibilityOpen(false)}
        onSetReduceMotion={setReduceMotion}
        onSetHighContrast={setHighContrast}
      />
    </div>
  );
}
