"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import type { ContributorDirectoryData, ContributorRecord } from "@/lib/contributors";
import { formatDate } from "@/lib/contributors";

type SortKey = "recent" | "first" | "total" | "login" | "name";

const sortOptions: Array<{ value: SortKey; label: string }> = [
  { value: "recent", label: "Most recent merged PR" },
  { value: "total", label: "Total merged PRs" },
  { value: "first", label: "First merged PR" },
  { value: "login", label: "GitHub handle" },
  { value: "name", label: "Name" },
];

function compareContributors(a: ContributorRecord, b: ContributorRecord, sortKey: SortKey) {
  if (sortKey === "total") {
    return b.totalMergedPrs - a.totalMergedPrs || a.login.localeCompare(b.login);
  }

  if (sortKey === "first") {
    return (
      new Date(a.firstMergedPr.mergedAt).getTime() - new Date(b.firstMergedPr.mergedAt).getTime() ||
      a.login.localeCompare(b.login)
    );
  }

  if (sortKey === "login") {
    return a.login.localeCompare(b.login);
  }

  if (sortKey === "name") {
    const aName = a.name || a.login;
    const bName = b.name || b.login;
    return aName.localeCompare(bName);
  }

  return (
    new Date(b.mostRecentMergedPr.mergedAt).getTime() - new Date(a.mostRecentMergedPr.mergedAt).getTime() ||
    a.login.localeCompare(b.login)
  );
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
    contributor.mostRecentMergedPr.repo,
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(query.toLowerCase());
}

function ContributorCard({ contributor }: { contributor: ContributorRecord }) {
  return (
    <article className="contributor-card">
      <div className="contributor-heading">
        <Image
          src={contributor.avatarUrl}
          alt={`${contributor.login} avatar`}
          width={56}
          height={56}
          className="avatar"
        />
        <div>
          <div className="contributor-title-row">
            <a href={contributor.profileUrl} target="_blank" rel="noreferrer" className="handle-link">
              @{contributor.login}
            </a>
            <span className="pill">{contributor.totalMergedPrs} merged PRs</span>
          </div>
          <div className="name-line">{contributor.name || "Name not added yet"}</div>
          <div className="meta-line">GitHub ID {contributor.githubUserId}</div>
        </div>
      </div>

      <dl className="details-grid">
        <div>
          <dt>First merged PR</dt>
          <dd>
            <a href={contributor.firstMergedPr.url} target="_blank" rel="noreferrer">
              {contributor.firstMergedPr.repo} #{contributor.firstMergedPr.number}
            </a>
            <span className="detail-title">{contributor.firstMergedPr.title}</span>
            <span>{formatDate(contributor.firstMergedPr.mergedAt)}</span>
          </dd>
        </div>
        <div>
          <dt>Most recent merged PR</dt>
          <dd>
            <a href={contributor.mostRecentMergedPr.url} target="_blank" rel="noreferrer">
              {contributor.mostRecentMergedPr.repo} #{contributor.mostRecentMergedPr.number}
            </a>
            <span className="detail-title">{contributor.mostRecentMergedPr.title}</span>
            <span>{formatDate(contributor.mostRecentMergedPr.mergedAt)}</span>
          </dd>
        </div>
      </dl>

      <div className="note-block">
        <p>{contributor.note || "This contributor has not added a public note yet."}</p>
      </div>
    </article>
  );
}

export function DirectoryClient({ data }: { data: ContributorDirectoryData }) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("recent");

  const filteredContributors = useMemo(() => {
    return [...data.contributors]
      .filter((contributor) => matchesQuery(contributor, query))
      .sort((a, b) => compareContributors(a, b, sortKey));
  }, [data.contributors, query, sortKey]);

  return (
    <main className="page-shell">
      <section className="hero-card">
        <p className="eyebrow">OpenHands Champions</p>
        <h1>Every merged PR contributor across OpenHands public repos.</h1>
        <p className="hero-copy">
          This directory is refreshed daily from public GitHub data and keeps the manual parts lightweight:
          contributors can open a PR to add their full name, add a short note, or hide their entry entirely.
        </p>

        <div className="stats-grid">
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
        </div>
      </section>

      <section className="cta-card">
        <div>
          <h2>Want to personalize your entry?</h2>
          <p>
            Open a PR editing <code>data/contributors.overrides.json</code> to add your full name, a short note,
            or set <code>hidden: true</code> if you prefer not to appear in the public directory. Each card shows
            the GitHub user ID used as the override key.
          </p>
        </div>
      </section>

      <section className="toolbar-card">
        <label className="search-field">
          <span>Search contributors</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by handle, name, note, or repo"
          />
        </label>

        <label className="sort-field">
          <span>Sort by</span>
          <select value={sortKey} onChange={(event) => setSortKey(event.target.value as SortKey)}>
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="results-meta">
        <p>
          Showing <strong>{filteredContributors.length}</strong> of <strong>{data.visibleContributorCount}</strong>{" "}
          contributors.
        </p>
        {data.generatedAt ? <p>Last synced {formatDate(data.generatedAt)}</p> : <p>Sync has not run yet.</p>}
      </section>

      <section className="contributors-grid">
        {filteredContributors.length > 0 ? (
          filteredContributors.map((contributor) => (
            <ContributorCard key={contributor.githubUserId} contributor={contributor} />
          ))
        ) : (
          <div className="empty-state">
            No contributors match your search yet. Try a different handle, repo, or note keyword.
          </div>
        )}
      </section>
    </main>
  );
}
