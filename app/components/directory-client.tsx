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
          width={72}
          height={72}
          className="avatar"
        />

        <div className="contributor-heading-copy">
          <div className="contributor-title-row">
            <a href={contributor.profileUrl} target="_blank" rel="noreferrer" className="handle-link">
              @{contributor.login}
            </a>
            <span className="pill">{contributor.totalMergedPrs} merged PRs</span>
          </div>

          <div className="name-line">{contributor.name || "Name not added yet"}</div>

          <div className="meta-line">
            <span className="meta-chip">GitHub ID {contributor.githubUserId}</span>
            <a href={contributor.profileUrl} target="_blank" rel="noreferrer" className="meta-link">
              View profile
            </a>
          </div>
        </div>
      </div>

      <dl className="details-grid">
        <div className="detail-panel">
          <dt>First merged PR</dt>
          <dd>
            <a href={contributor.firstMergedPr.url} target="_blank" rel="noreferrer">
              {contributor.firstMergedPr.repo} #{contributor.firstMergedPr.number}
            </a>
            <span className="detail-title">{contributor.firstMergedPr.title}</span>
            <span>{formatDate(contributor.firstMergedPr.mergedAt)}</span>
          </dd>
        </div>

        <div className="detail-panel">
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
        <span className="note-label">Notes</span>
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
        <div className="hero-grid">
          <div>
            <div className="hero-badge-row">
              <p className="eyebrow">OpenHands Champions</p>
              <p className="eyebrow eyebrow-muted">Merged PR contributor directory</p>
            </div>

            <h1>Every merged PR contributor across OpenHands public repos.</h1>

            <p className="hero-copy">
              Styled to feel like the OpenHands company site, but scoped to a lightweight public directory.
              The page stays JSON-backed, refreshes from public GitHub data, and lets contributors add their
              name, note, or opt out through a small override file.
            </p>

            <div className="hero-actions">
              <a href="#directory" className="brand-button brand-button-primary">
                Browse directory
              </a>
              <a href="#personalize" className="brand-button brand-button-secondary">
                Personalize your entry
              </a>
            </div>
          </div>

          <aside className="hero-sidecard">
            <p className="hero-side-eyebrow">How v1 works</p>
            <ul className="hero-list">
              <li>Merged PRs only, deduped by stable GitHub user ID.</li>
              <li>Employee, org-member, service-account, and bot exclusions are applied before publish.</li>
              <li>Visible entries can be enriched or hidden via a small JSON override file in the repo.</li>
            </ul>
            <p className="hero-side-meta">
              Last synced <strong>{data.generatedAt ? formatDate(data.generatedAt) : "Not synced yet"}</strong>
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

      <section className="cta-card" id="personalize">
        <div className="cta-grid">
          <div>
            <p className="eyebrow eyebrow-dark">Self-serve enrichment</p>
            <h2 className="section-title">Want to personalize your entry?</h2>
            <p>
              Open a PR editing <code>data/contributors.overrides.json</code> to add your full name, add a short
              note, or set <code>hidden: true</code> if you prefer not to appear in the public directory. Each card
              shows the GitHub user ID used as the override key.
            </p>
          </div>

          <div className="cta-note">
            <span className="cta-note-label">Override shape</span>
            <code>{`"123456": { "name": "Ada Lovelace", "note": "Worked on docs.", "hidden": false }`}</code>
          </div>
        </div>
      </section>

      <section className="toolbar-card" id="directory">
        <div className="toolbar-copy">
          <p className="eyebrow eyebrow-dark">Directory</p>
          <h2 className="section-title">Search the contributor roster.</h2>
          <p className="toolbar-note">
            Filter by handle, name, note, or repo, then sort by recency, total merged PRs, first merge, or
            alphabetically.
          </p>
        </div>

        <div className="toolbar-controls">
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
        </div>
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
