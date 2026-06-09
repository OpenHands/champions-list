"use client";

import Image from "next/image";
import { Fragment, useEffect, useMemo, useState } from "react";
import { AccessibilityControls } from "@/app/components/accessibility-controls";
import { PageNav } from "@/app/components/page-nav";
import { formatDate } from "@/lib/contributors";
import type {
  IssueCommentReference,
  IssueChampionRecord,
  IssueDirectoryData,
  RecentIssueActivityRecord,
} from "@/lib/issues";

type SortKey = "login" | "name" | "opened" | "commented" | "firstActivity" | "recentActivity";
type SortDirection = "asc" | "desc";

const sortColumns: Array<{ key: SortKey; label: string }> = [
  { key: "login", label: "GitHub" },
  { key: "name", label: "Name" },
  { key: "opened", label: "Issues opened" },
  { key: "commented", label: "Issue comments" },
  { key: "firstActivity", label: "First activity" },
  { key: "recentActivity", label: "Most recent activity" },
];

const defaultSortDirection: Record<SortKey, SortDirection> = {
  login: "asc",
  name: "asc",
  opened: "desc",
  commented: "desc",
  firstActivity: "desc",
  recentActivity: "desc",
};

function compareIssueChampions(
  a: IssueChampionRecord,
  b: IssueChampionRecord,
  sortKey: SortKey,
  direction: SortDirection
) {
  let comparison = 0;

  if (sortKey === "login") {
    comparison = a.login.localeCompare(b.login);
  } else if (sortKey === "name") {
    comparison = (a.name || a.login).localeCompare(b.name || b.login);
  } else if (sortKey === "opened") {
    comparison = a.issuesOpenedCount - b.issuesOpenedCount;
  } else if (sortKey === "commented") {
    comparison = a.issueCommentsCount - b.issueCommentsCount;
  } else if (sortKey === "firstActivity") {
    comparison = new Date(a.firstActivityAt).getTime() - new Date(b.firstActivityAt).getTime();
  } else if (sortKey === "recentActivity") {
    comparison = new Date(a.mostRecentActivityAt).getTime() - new Date(b.mostRecentActivityAt).getTime();
  }

  if (comparison === 0) {
    comparison = a.login.localeCompare(b.login);
  }

  return direction === "asc" ? comparison : -comparison;
}

function matchesQuery(champion: IssueChampionRecord, query: string) {
  if (!query) {
    return true;
  }

  const haystack = [
    champion.login,
    champion.name,
    champion.firstIssue?.repo,
    champion.firstIssue?.title,
    champion.mostRecentIssue?.repo,
    champion.mostRecentIssue?.title,
    champion.mostRecentComment?.repo,
    champion.mostRecentComment?.title,
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

function formatIssueTitle(title: string) {
  return title.trim() || "Untitled issue";
}

function activityHref(activity: RecentIssueActivityRecord) {
  return activity.commentUrl ?? activity.issue.url;
}

function activityLabel(activity: RecentIssueActivityRecord) {
  return activity.type === "issueComment"
    ? `Comment on ${activity.issue.repo} #${activity.issue.number}`
    : `${activity.issue.repo} #${activity.issue.number}`;
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

function NewestIssueTickerItem({ champion }: { champion: IssueChampionRecord }) {
  const totalActivities = champion.issuesOpenedCount + champion.issueCommentsCount;

  return (
    <div className="ticker-chip">
      <Image src={champion.avatarUrl} alt={`${champion.login} avatar`} width={28} height={28} className="ticker-avatar" />
      <a href={champion.profileUrl} target="_blank" rel="noreferrer" className="ticker-handle">
        @{champion.login}
      </a>
      <span className="ticker-pr-link">{totalActivities} issue activities</span>
    </div>
  );
}

function RecentIssueActivityTickerItem({ activity }: { activity: RecentIssueActivityRecord }) {
  return (
    <div className="ticker-chip">
      <Image src={activity.avatarUrl} alt={`${activity.login} avatar`} width={28} height={28} className="ticker-avatar" />
      <a href={activity.profileUrl} target="_blank" rel="noreferrer" className="ticker-handle">
        @{activity.login}
      </a>
      <a href={activityHref(activity)} target="_blank" rel="noreferrer" className="ticker-pr-link">
        {activityLabel(activity)}
      </a>
    </div>
  );
}

function DetailReferenceCard({
  eyebrow,
  reference,
  href,
  emptyCopy,
}: {
  eyebrow: string;
  reference: IssueCommentReference | IssueChampionRecord["firstIssue"] | IssueChampionRecord["mostRecentIssue"];
  href?: string;
  emptyCopy: string;
}) {
  return (
    <section className="detail-card">
      <p className="detail-eyebrow">{eyebrow}</p>
      {reference ? (
        <>
          <a href={href ?? reference.url} target="_blank" rel="noreferrer" className="detail-pr-link">
            {reference.repo} #{reference.number}
          </a>
          <p className="detail-copy">{formatIssueTitle(reference.title)}</p>
          <p className="detail-date">{formatDate(reference.createdAt)}</p>
        </>
      ) : (
        <p className="detail-copy">{emptyCopy}</p>
      )}
    </section>
  );
}

function ExpandedIssueRow({ champion }: { champion: IssueChampionRecord }) {
  const totalActivities = champion.issuesOpenedCount + champion.issueCommentsCount;

  return (
    <div className="row-detail-panel">
      <div className="row-detail-top">
        <div className="row-detail-identity">
          <Image src={champion.avatarUrl} alt={`${champion.login} avatar`} width={56} height={56} className="detail-avatar" />
          <div>
            <div className="row-detail-heading">
              <span className="row-detail-handle">@{champion.login}</span>
              {champion.name ? <span className="row-detail-name">{champion.name}</span> : null}
            </div>
            <div className="row-detail-meta">
              <span className="meta-chip">GitHub ID {champion.githubUserId}</span>
              <span className="meta-chip">Opened {champion.issuesOpenedCount}</span>
              <span className="meta-chip">Commented {champion.issueCommentsCount}</span>
              <span className="meta-chip">First activity {formatDate(champion.firstActivityAt)}</span>
              <span className="meta-chip">Most recent {formatDate(champion.mostRecentActivityAt)}</span>
              <a href={champion.profileUrl} target="_blank" rel="noreferrer" className="meta-chip meta-chip-link">
                Open profile
              </a>
            </div>
          </div>
        </div>

        <div className="row-detail-stat">
          <span>Total activities</span>
          <strong>{totalActivities}</strong>
        </div>
      </div>

      <div className="row-detail-grid">
        <DetailReferenceCard
          eyebrow="First opened issue"
          reference={champion.firstIssue}
          emptyCopy="No opened issue from this user is tracked inside the current 365-day window."
        />

        <DetailReferenceCard
          eyebrow="Most recent opened issue"
          reference={champion.mostRecentIssue}
          emptyCopy="No opened issue from this user is tracked inside the current 365-day window."
        />

        <DetailReferenceCard
          eyebrow="Most recent comment"
          reference={champion.mostRecentComment}
          href={champion.mostRecentComment?.commentUrl}
          emptyCopy="No issue comments from this user are tracked inside the current 365-day window."
        />
      </div>
    </div>
  );
}

export function IssuesDirectoryClient({ data }: { data: IssueDirectoryData }) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("recentActivity");
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
    window.localStorage.setItem("champions-reduce-motion", String(reduceMotion));
  }, [reduceMotion]);

  useEffect(() => {
    window.localStorage.setItem("champions-high-contrast", String(highContrast));
  }, [highContrast]);

  const filteredUsers = useMemo(() => {
    return [...data.users]
      .filter((champion) => matchesQuery(champion, query))
      .sort((a, b) => compareIssueChampions(a, b, sortKey, sortDirection));
  }, [data.users, query, sortDirection, sortKey]);

  const pageCount = Math.max(1, Math.ceil(filteredUsers.length / pageSize));

  useEffect(() => {
    setPage(1);
  }, [pageSize, query, sortDirection, sortKey]);

  useEffect(() => {
    if (page > pageCount) {
      setPage(pageCount);
    }
  }, [page, pageCount]);

  const pageStartIndex = (page - 1) * pageSize;
  const pageEndIndex = Math.min(pageStartIndex + pageSize, filteredUsers.length);
  const paginatedUsers = useMemo(() => {
    return filteredUsers.slice(pageStartIndex, pageEndIndex);
  }, [filteredUsers, pageEndIndex, pageStartIndex]);

  const showingStart = filteredUsers.length === 0 ? 0 : pageStartIndex + 1;
  const showingEnd = pageEndIndex;

  const newestTickerItems = useMemo(
    () => duplicateTickerItems(data.newestIssueChampions.slice(0, 18)),
    [data.newestIssueChampions]
  );
  const recentActivityTickerItems = useMemo(
    () => duplicateTickerItems(data.recentActivities.slice(0, 24)),
    [data.recentActivities]
  );

  const allExpanded = paginatedUsers.length > 0 && paginatedUsers.every((champion) => expandedIds.has(champion.githubUserId));

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
      paginatedUsers.forEach((champion) => next.add(champion.githubUserId));
      return next;
    });
  }

  function collapseAll() {
    setExpandedIds(new Set());
  }

  return (
    <div className={`directory-root${highContrast ? " high-contrast" : ""}${reduceMotion ? " reduce-motion" : ""}`}>
      <main className="page-shell">
        <PageNav current="issues" />

        <section className="hero-card">
          <div className="hero-grid">
            <div>
              <div className="hero-badge-row">
                <p className="eyebrow">OpenHands Champions</p>
                <p className="eyebrow eyebrow-muted">Issue Champions</p>
              </div>

              <h1>The Official Directory of Issue Creators and Commenters</h1>

              <p className="hero-copy">
                Explore the people opening issues and keeping conversations moving across OpenHands public repositories.
                This view tracks the rolling last 365 days of issues opened and issue comments for external community
                contributors.
              </p>

              <div className="hero-actions">
                <a href="#issues-directory" className="brand-button brand-button-primary">
                  Jump to issue table
                </a>
                <a href="/" className="brand-button brand-button-secondary">
                  View PR Champions
                </a>
              </div>
            </div>

            <aside className="hero-sidecard">
              <p className="hero-side-eyebrow">How This Works</p>
              <ul className="hero-list">
                <li>Issue Champions counts issues opened and issue comments from the last 365 days only.</li>
                <li>Fresh Issues + Comments shows raw recent issue activity, including repeat appearances.</li>
                <li>Bot accounts, non-user actors, and internal excluded logins are filtered out.</li>
                <li>
                  Want your public name updated or entry hidden across the site? Open a PR in {" "}
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
                Window <strong>{formatDate(data.windowStart)}</strong> → <strong>{formatDate(data.windowEnd)}</strong>
              </p>
            </aside>
          </div>
        </section>

        <section className="stats-grid" aria-label="Issue champion statistics">
          <div>
            <span>Issue champions</span>
            <strong>{data.visibleChampionCount}</strong>
          </div>
          <div>
            <span>Issues opened</span>
            <strong>{data.totalIssuesOpened}</strong>
          </div>
          <div>
            <span>Issue comments</span>
            <strong>{data.totalIssueComments}</strong>
          </div>
          <div>
            <span>Public repos scanned</span>
            <strong>{data.scannedRepoCount}</strong>
          </div>
        </section>

        <section className="ticker-stack">
          <div className="ticker-card" data-motion={reduceMotion ? "paused" : "running"}>
            <div className="ticker-heading-row">
              <div>
                <p className="eyebrow eyebrow-dark">Newest Issue Champions</p>
                <h2 className="section-title">People with fresh first issue activity</h2>
              </div>
            </div>
            <div className="ticker-viewport" aria-live="off">
              <div className="ticker-track">
                {newestTickerItems.map((champion, index) => (
                  <NewestIssueTickerItem key={`${champion.githubUserId}-${index}`} champion={champion} />
                ))}
              </div>
            </div>
          </div>

          <div className="ticker-card" data-motion={reduceMotion ? "paused" : "running"}>
            <div className="ticker-heading-row">
              <div>
                <p className="eyebrow eyebrow-dark">Fresh Issues + Comments</p>
                <h2 className="section-title">Latest issue conversations</h2>
              </div>
            </div>
            <div className="ticker-viewport" aria-live="off">
              <div className="ticker-track ticker-track-reverse">
                {recentActivityTickerItems.map((activity, index) => (
                  <RecentIssueActivityTickerItem
                    key={`${activity.githubUserId}-${activity.type}-${activity.issue.repo}-${activity.issue.number}-${index}`}
                    activity={activity}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="toolbar-card" id="issues-directory">
          <div className="toolbar-copy">
            <p className="eyebrow eyebrow-dark">Directory</p>
            <h2 className="section-title">Official Issue Champions Directory</h2>
          </div>

          <div className="toolbar-controls">
            <label className="search-field">
              <span>Search directory</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by handle, repo, or issue title"
              />
            </label>

            <div className="table-actions">
              <button
                type="button"
                className="action-button"
                onClick={expandAll}
                disabled={paginatedUsers.length === 0 || allExpanded}
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
            Showing <strong>{showingStart}</strong>–<strong>{showingEnd}</strong> of <strong>{filteredUsers.length}</strong>{" "}
            {query ? "matching " : ""}issue champions. <strong>{data.hiddenChampionCount}</strong> hidden.
          </p>
          <p>
            Sorted by <strong>{sortColumns.find((column) => column.key === sortKey)?.label}</strong> {sortDirection}.
          </p>
        </section>

        {filteredUsers.length > 0 ? (
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
                {filteredUsers.length > 0 ? (
                  paginatedUsers.map((champion) => {
                    const isExpanded = expandedIds.has(champion.githubUserId);
                    return (
                      <Fragment key={champion.githubUserId}>
                        <tr
                          className={`directory-row${isExpanded ? " directory-row-expanded" : ""}`}
                          tabIndex={0}
                          aria-expanded={isExpanded}
                          onClick={(event) => {
                            if (isInteractiveTarget(event.target)) {
                              return;
                            }
                            toggleExpanded(champion.githubUserId);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              toggleExpanded(champion.githubUserId);
                            }
                          }}
                        >
                          <td>
                            <div className="identity-cell">
                              <Image
                                src={champion.avatarUrl}
                                alt={`${champion.login} avatar`}
                                width={32}
                                height={32}
                                className="table-avatar"
                              />
                              <span>@{champion.login}</span>
                            </div>
                          </td>
                          <td>{champion.name || <span className="table-muted">—</span>}</td>
                          <td>{champion.issuesOpenedCount}</td>
                          <td>{champion.issueCommentsCount}</td>
                          <td>{formatDate(champion.firstActivityAt)}</td>
                          <td>{formatDate(champion.mostRecentActivityAt)}</td>
                          <td>
                            <button
                              type="button"
                              className="row-expand-button"
                              onClick={() => toggleExpanded(champion.githubUserId)}
                              aria-expanded={isExpanded}
                            >
                              {isExpanded ? "Collapse" : "Expand"}
                            </button>
                          </td>
                        </tr>
                        {isExpanded ? (
                          <tr className="directory-detail-row">
                            <td colSpan={7}>
                              <ExpandedIssueRow champion={champion} />
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7}>
                      <div className="empty-state">
                        No issue champions match your search yet. Try a different handle, repo, or issue keyword.
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
              <p className="eyebrow eyebrow-dark">Shared profile controls</p>
              <h2 className="section-title">Need to personalize or hide your public entry?</h2>
              <p>
                Open a PR editing <code>data/contributors.overrides.json</code> to add your full name or set
                <code> hidden: true</code>. The same override powers both the PR Champions and Issue Champions views.
              </p>
            </div>

            <div className="cta-note">
              <span className="cta-note-label">Override shape</span>
              <code>{`"123456": { "name": "Ada Lovelace", "hidden": false }`}</code>
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
