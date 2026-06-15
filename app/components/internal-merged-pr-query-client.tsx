"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import type { ContributorRecord, PullRequestSummary } from "@/lib/contributors";
import { formatDate, mergedPrYear } from "@/lib/contributors";

type MilestoneField = "firstMergedPr" | "mostRecentMergedPr";
type SortOption = "matched-desc" | "matched-asc" | "login-asc" | "name-asc" | "total-desc";

interface InternalMergedPrQueryData {
  generatedAt: string | null;
  organization: string;
  repoCount: number;
  scannedRepoCount: number;
  totalMergedPrs: number;
  hiddenContributorCount: number;
  visibleContributorCount: number;
  availableYears: string[];
  contributors: ContributorRecord[];
}

interface SubmittedFilters {
  milestone: MilestoneField;
  startDate: string;
  endDate: string;
  year: string;
  query: string;
  sort: SortOption;
  includeHidden: boolean;
}

const ALL_YEARS_VALUE = "all";

function getMilestone(contributor: ContributorRecord, milestone: MilestoneField): PullRequestSummary {
  return contributor[milestone];
}

function formatUtcTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));
}

function formatDateInput(value: string): string {
  if (!value) {
    return "any date";
  }

  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

function getDateStart(value: string): Date {
  return new Date(`${value}T00:00:00Z`);
}

function getDateEndExclusive(value: string): Date {
  const date = getDateStart(value);
  date.setUTCDate(date.getUTCDate() + 1);
  return date;
}

function matchesTextQuery(contributor: ContributorRecord, query: string, milestone: MilestoneField): boolean {
  if (!query) {
    return true;
  }

  const matchedPr = getMilestone(contributor, milestone);
  const haystack = [
    contributor.login,
    contributor.name,
    contributor.note,
    contributor.contributionYears.join(" "),
    contributor.firstMergedPr.repo,
    contributor.firstMergedPr.title,
    contributor.mostRecentMergedPr.repo,
    contributor.mostRecentMergedPr.title,
    matchedPr.repo,
    matchedPr.title,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(query.toLowerCase());
}

function sortContributors(contributors: ContributorRecord[], milestone: MilestoneField, sort: SortOption): ContributorRecord[] {
  return [...contributors].sort((a, b) => {
    const aMatched = getMilestone(a, milestone);
    const bMatched = getMilestone(b, milestone);

    if (sort === "matched-asc") {
      return new Date(aMatched.mergedAt).getTime() - new Date(bMatched.mergedAt).getTime() || a.login.localeCompare(b.login);
    }

    if (sort === "matched-desc") {
      return new Date(bMatched.mergedAt).getTime() - new Date(aMatched.mergedAt).getTime() || a.login.localeCompare(b.login);
    }

    if (sort === "name-asc") {
      return (a.name || a.login).localeCompare(b.name || b.login) || a.login.localeCompare(b.login);
    }

    if (sort === "total-desc") {
      return b.totalMergedPrs - a.totalMergedPrs || a.login.localeCompare(b.login);
    }

    return a.login.localeCompare(b.login);
  });
}

function getMilestoneLabel(milestone: MilestoneField): string {
  return milestone === "firstMergedPr" ? "first merged PR" : "most recent merged PR";
}

function buildResultSummary(filters: SubmittedFilters): string {
  const milestoneLabel = getMilestoneLabel(filters.milestone);
  const rangeParts: string[] = [];

  if (filters.startDate) {
    rangeParts.push(`from ${formatDateInput(filters.startDate)}`);
  }

  if (filters.endDate) {
    rangeParts.push(`through ${formatDateInput(filters.endDate)}`);
  }

  if (filters.year !== ALL_YEARS_VALUE) {
    rangeParts.push(`in ${filters.year}`);
  }

  if (filters.query) {
    rangeParts.push(`matching “${filters.query}”`);
  }

  if (!filters.includeHidden) {
    rangeParts.push("excluding hidden contributors");
  }

  return rangeParts.length > 0 ? `${milestoneLabel} ${rangeParts.join(" • ")}` : `${milestoneLabel} across all tracked contributors`;
}

export function InternalMergedPrQueryClient({ data }: { data: InternalMergedPrQueryData }) {
  const [milestone, setMilestone] = useState<MilestoneField>("firstMergedPr");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [year, setYear] = useState<string>(ALL_YEARS_VALUE);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortOption>("matched-desc");
  const [includeHidden, setIncludeHidden] = useState(true);
  const [submittedFilters, setSubmittedFilters] = useState<SubmittedFilters | null>(null);
  const [formError, setFormError] = useState("");

  const matchedContributors = useMemo(() => {
    if (!submittedFilters) {
      return [];
    }

    const filtered = data.contributors.filter((contributor) => {
      if (!submittedFilters.includeHidden && contributor.hidden) {
        return false;
      }

      const matchedPr = getMilestone(contributor, submittedFilters.milestone);
      const matchedDate = new Date(matchedPr.mergedAt);

      if (submittedFilters.startDate && matchedDate < getDateStart(submittedFilters.startDate)) {
        return false;
      }

      if (submittedFilters.endDate && matchedDate >= getDateEndExclusive(submittedFilters.endDate)) {
        return false;
      }

      if (submittedFilters.year !== ALL_YEARS_VALUE && mergedPrYear(matchedPr.mergedAt) !== submittedFilters.year) {
        return false;
      }

      return matchesTextQuery(contributor, submittedFilters.query, submittedFilters.milestone);
    });

    return sortContributors(filtered, submittedFilters.milestone, submittedFilters.sort);
  }, [data.contributors, submittedFilters]);

  const hiddenMatches = matchedContributors.filter((contributor) => contributor.hidden).length;
  const totalMergedPrsAcrossMatches = matchedContributors.reduce((total, contributor) => total + contributor.totalMergedPrs, 0);
  const matchingYears = useMemo(() => {
    return [...new Set(matchedContributors.flatMap((contributor) => contributor.contributionYears))]
      .sort((a, b) => Number(b) - Number(a) || b.localeCompare(a))
      .join(", ");
  }, [matchedContributors]);

  function handleRunQuery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (startDate && endDate && getDateStart(startDate) > getDateStart(endDate)) {
      setFormError("Start date must be on or before the end date.");
      return;
    }

    setFormError("");
    setSubmittedFilters({
      milestone,
      startDate,
      endDate,
      year,
      query: query.trim(),
      sort,
      includeHidden,
    });
  }

  function handleClear() {
    setMilestone("firstMergedPr");
    setStartDate("");
    setEndDate("");
    setYear(ALL_YEARS_VALUE);
    setQuery("");
    setSort("matched-desc");
    setIncludeHidden(true);
    setSubmittedFilters(null);
    setFormError("");
  }

  return (
    <div className="directory-root internal-directory-root">
      <main className="page-shell">
        <section className="hero-card">
          <div className="hero-grid">
            <div>
              <div className="hero-badge-row">
                <p className="eyebrow">Internal</p>
                <p className="eyebrow eyebrow-muted">Merged PR query view</p>
              </div>

              <h1>Query PR champions without touching the public leaderboard</h1>

              <p className="hero-copy">
                Start with a blank slate, then filter contributors by their first or most recent merged PR date, narrow by
                milestone year, and search by person or repo context.
              </p>

              <div className="hero-actions">
                <a href="#query-console" className="brand-button brand-button-primary">
                  Jump to query console
                </a>
                <Link href="/" className="brand-button brand-button-secondary">
                  Back to PR Champions
                </Link>
              </div>
            </div>

            <aside className="hero-sidecard">
              <p className="hero-side-eyebrow">Scope</p>
              <ul className="hero-list">
                <li>Query contributor milestones only: first merged PR or most recent merged PR.</li>
                <li>Run precise date windows without exposing extra controls on the public directory.</li>
                <li>Include hidden contributors when you need the full internal dataset.</li>
              </ul>
              <p className="hero-side-meta">
                Last synced <strong>{data.generatedAt ? `${formatUtcTimestamp(data.generatedAt)} UTC` : "Not synced yet"}</strong>
              </p>
              <p className="hero-side-meta">
                Tracking <strong>{data.contributors.length}</strong> contributors across <strong>{data.scannedRepoCount}</strong> scanned repos.
              </p>
            </aside>
          </div>
        </section>

        <section className="stats-grid" aria-label="Merged PR query data summary">
          <div>
            <span>Tracked contributors</span>
            <strong>{data.contributors.length}</strong>
          </div>
          <div>
            <span>Hidden contributors</span>
            <strong>{data.hiddenContributorCount}</strong>
          </div>
          <div>
            <span>Tracked merged PRs</span>
            <strong>{data.totalMergedPrs}</strong>
          </div>
        </section>

        <section className="toolbar-card" id="query-console">
          <div className="toolbar-copy">
            <p className="eyebrow eyebrow-dark">Query console</p>
            <h2 className="section-title">Run a structured merged PR query</h2>
            <p className="toolbar-note">
              Pick the contributor milestone you care about, add a date range when needed, and only then render the
              matching rows.
            </p>
          </div>

          <form className="toolbar-controls" onSubmit={handleRunQuery}>
            <div className="toolbar-filter-grid internal-toolbar-filter-grid">
              <label className="search-field">
                <span>Milestone</span>
                <select value={milestone} onChange={(event) => setMilestone(event.target.value as MilestoneField)}>
                  <option value="firstMergedPr">First merged PR</option>
                  <option value="mostRecentMergedPr">Most recent merged PR</option>
                </select>
              </label>

              <label className="search-field">
                <span>Start date</span>
                <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
              </label>

              <label className="search-field">
                <span>End date</span>
                <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
              </label>

              <label className="search-field">
                <span>Milestone year</span>
                <select value={year} onChange={(event) => setYear(event.target.value)}>
                  <option value={ALL_YEARS_VALUE}>All years</option>
                  {data.availableYears.map((entryYear) => (
                    <option key={entryYear} value={entryYear}>
                      {entryYear}
                    </option>
                  ))}
                </select>
              </label>

              <label className="search-field">
                <span>Keyword</span>
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search by handle, name, repo, or PR title"
                />
              </label>

              <label className="search-field">
                <span>Sort results</span>
                <select value={sort} onChange={(event) => setSort(event.target.value as SortOption)}>
                  <option value="matched-desc">Matched date: newest first</option>
                  <option value="matched-asc">Matched date: oldest first</option>
                  <option value="total-desc">Merged PRs: highest first</option>
                  <option value="login-asc">GitHub login: A → Z</option>
                  <option value="name-asc">Name: A → Z</option>
                </select>
              </label>
            </div>

            <label className="checkbox-field">
              <input type="checkbox" checked={includeHidden} onChange={(event) => setIncludeHidden(event.target.checked)} />
              <span>Include hidden contributors in the internal query results</span>
            </label>

            {formError ? <p className="query-callout query-callout-error">{formError}</p> : null}

            <div className="table-actions query-form-actions">
              <button type="submit" className="action-button">
                Run query
              </button>
              <button type="button" className="action-button action-button-secondary" onClick={handleClear}>
                Clear filters
              </button>
            </div>
          </form>
        </section>

        {submittedFilters ? (
          <>
            <section className="results-meta">
              <p>
                <strong>{matchedContributors.length}</strong> contributors matched <strong>{buildResultSummary(submittedFilters)}</strong>.
              </p>
              <p>
                Showing <strong>{hiddenMatches}</strong> hidden matches and <strong>{totalMergedPrsAcrossMatches}</strong> lifetime merged PRs across the result set.
              </p>
            </section>

            <section className="stats-grid" aria-label="Merged PR query result summary">
              <div>
                <span>Matches</span>
                <strong>{matchedContributors.length}</strong>
              </div>
              <div>
                <span>Hidden matches</span>
                <strong>{hiddenMatches}</strong>
              </div>
              <div>
                <span>Years represented</span>
                <strong>{matchingYears || "—"}</strong>
              </div>
            </section>

            <section className="directory-table-card">
              <div className="table-scroll-wrap">
                <table className="directory-table">
                  <thead>
                    <tr>
                      <th scope="col">
                        <span className="th-static">GitHub</span>
                      </th>
                      <th scope="col">
                        <span className="th-static">Name</span>
                      </th>
                      <th scope="col">
                        <span className="th-static">Matched milestone</span>
                      </th>
                      <th scope="col">
                        <span className="th-static">Matched date</span>
                      </th>
                      <th scope="col">
                        <span className="th-static">First merged PR</span>
                      </th>
                      <th scope="col">
                        <span className="th-static">Most recent merged PR</span>
                      </th>
                      <th scope="col">
                        <span className="th-static">Merged PRs</span>
                      </th>
                      <th scope="col">
                        <span className="th-static">Visibility</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {matchedContributors.length > 0 ? (
                      matchedContributors.map((contributor) => {
                        const matchedPr = getMilestone(contributor, submittedFilters.milestone);

                        return (
                          <tr key={contributor.githubUserId} className="directory-row">
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
                              <a href={matchedPr.url} target="_blank" rel="noreferrer" className="table-link">
                                {matchedPr.repo} #{matchedPr.number}
                              </a>
                              <p className="query-table-copy">{matchedPr.title}</p>
                            </td>
                            <td className="query-table-date">{formatDate(matchedPr.mergedAt)}</td>
                            <td>
                              <a href={contributor.firstMergedPr.url} target="_blank" rel="noreferrer" className="table-link">
                                {contributor.firstMergedPr.repo} #{contributor.firstMergedPr.number}
                              </a>
                            </td>
                            <td>
                              <a href={contributor.mostRecentMergedPr.url} target="_blank" rel="noreferrer" className="table-link">
                                {contributor.mostRecentMergedPr.repo} #{contributor.mostRecentMergedPr.number}
                              </a>
                            </td>
                            <td>{contributor.totalMergedPrs}</td>
                            <td>
                              <span className={`status-pill${contributor.hidden ? " status-pill-hidden" : ""}`}>
                                {contributor.hidden ? "Hidden" : "Public"}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={8}>
                          <div className="empty-state">
                            No contributors matched this merged PR query. Try widening the date window or removing a keyword.
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        ) : (
          <section className="empty-state query-blank-state">
            Select a milestone, add any dates or keywords you need, and run the query to render contributor results.
          </section>
        )}
      </main>
    </div>
  );
}
