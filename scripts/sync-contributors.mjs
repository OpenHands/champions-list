import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const dataDir = path.join(rootDir, "data");
const generatedPath = path.join(dataDir, "contributors.generated.json");
const excludedPath = path.join(dataDir, "excluded-logins.json");
const overridesPath = path.join(dataDir, "contributors.overrides.json");
const readmePath = path.join(rootDir, "README.md");
const publicDir = path.join(rootDir, "public");
const contributorWallPath = path.join(publicDir, "contributor-wall.svg");

const org = process.env.GITHUB_ORG ?? "OpenHands";
const token = process.env.GITHUB_TOKEN;
const useExistingData = process.env.USE_EXISTING_DATA === "1";

if (!useExistingData && !token) {
  throw new Error("GITHUB_TOKEN is required to sync contributors.");
}

const graphqlEndpoint = "https://api.github.com/graphql";
const recentMergedPrLimit = Number(process.env.RECENT_MERGES_LIMIT ?? "60");

async function readJson(filePath) {
  const content = await fs.readFile(filePath, "utf8");
  return JSON.parse(content);
}

async function githubGraphQL(query, variables) {
  const response = await fetch(graphqlEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "User-Agent": "OpenHands Champions Sync",
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`GitHub GraphQL request failed with ${response.status}`);
  }

  const payload = await response.json();
  if (payload.errors?.length) {
    throw new Error(payload.errors.map((error) => error.message).join("; "));
  }

  return payload.data;
}

async function fetchPublicRepos() {
  const repos = [];
  let cursor = null;

  while (true) {
    const data = await githubGraphQL(
      `query PublicRepos($org: String!, $cursor: String) {
        organization(login: $org) {
          repositories(first: 100, after: $cursor, privacy: PUBLIC, orderBy: { field: NAME, direction: ASC }) {
            nodes {
              name
              isArchived
              isFork
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      }`,
      { org, cursor }
    );

    const page = data.organization?.repositories;
    if (!page) {
      break;
    }

    repos.push(...page.nodes.map((repo) => ({
      name: repo.name,
      isArchived: repo.isArchived,
      isFork: repo.isFork,
    })));

    if (!page.pageInfo.hasNextPage) {
      break;
    }

    cursor = page.pageInfo.endCursor;
  }

  return repos;
}

async function fetchMergedPullRequests(repoName) {
  const pullRequests = [];
  let cursor = null;

  while (true) {
    const data = await githubGraphQL(
      `query RepoPullRequests($org: String!, $repo: String!, $cursor: String) {
        repository(owner: $org, name: $repo) {
          pullRequests(first: 100, after: $cursor, states: MERGED, orderBy: { field: UPDATED_AT, direction: DESC }) {
            nodes {
              id
              number
              title
              url
              mergedAt
              author {
                __typename
                login
                avatarUrl
                url
                ... on User {
                  databaseId
                }
              }
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      }`,
      { org, repo: repoName, cursor }
    );

    const page = data.repository?.pullRequests;
    if (!page) {
      break;
    }

    pullRequests.push(...page.nodes);

    if (!page.pageInfo.hasNextPage) {
      break;
    }

    cursor = page.pageInfo.endCursor;
  }

  return pullRequests;
}

function normalizeLogin(login) {
  return login.trim().toLowerCase();
}

function shouldSkipAuthor(author, excludedLogins) {
  if (!author?.login) {
    return true;
  }

  const login = normalizeLogin(author.login);
  if (excludedLogins.has(login)) {
    return true;
  }

  if (author.__typename !== "User") {
    return true;
  }

  if (!author.databaseId) {
    return true;
  }

  if (login.endsWith("[bot]")) {
    return true;
  }

  return false;
}

function summarizePullRequest(repoName, pullRequest) {
  return {
    repo: repoName,
    number: pullRequest.number,
    title: pullRequest.title,
    url: pullRequest.url,
    mergedAt: pullRequest.mergedAt,
  };
}

function summarizeRecentMergedPullRequest(repoName, pullRequest) {
  return {
    githubUserId: String(pullRequest.author.databaseId),
    login: pullRequest.author.login,
    avatarUrl: pullRequest.author.avatarUrl,
    profileUrl: pullRequest.author.url,
    pullRequest: summarizePullRequest(repoName, pullRequest),
  };
}

function updateContributor(contributors, repoName, pullRequest) {
  const githubUserId = String(pullRequest.author.databaseId);
  const current = contributors.get(githubUserId) ?? {
    githubUserId,
    login: pullRequest.author.login,
    avatarUrl: pullRequest.author.avatarUrl,
    profileUrl: pullRequest.author.url,
    firstMergedPr: summarizePullRequest(repoName, pullRequest),
    mostRecentMergedPr: summarizePullRequest(repoName, pullRequest),
    totalMergedPrs: 0,
  };

  current.login = pullRequest.author.login;
  current.avatarUrl = pullRequest.author.avatarUrl;
  current.profileUrl = pullRequest.author.url;
  current.totalMergedPrs += 1;

  if (new Date(pullRequest.mergedAt) < new Date(current.firstMergedPr.mergedAt)) {
    current.firstMergedPr = summarizePullRequest(repoName, pullRequest);
  }

  if (new Date(pullRequest.mergedAt) > new Date(current.mostRecentMergedPr.mergedAt)) {
    current.mostRecentMergedPr = summarizePullRequest(repoName, pullRequest);
  }

  contributors.set(githubUserId, current);
}

function sortContributors(contributors) {
  return [...contributors].sort((a, b) => {
    return (
      new Date(b.mostRecentMergedPr.mergedAt) - new Date(a.mostRecentMergedPr.mergedAt) ||
      b.totalMergedPrs - a.totalMergedPrs ||
      a.login.localeCompare(b.login)
    );
  });
}

function sortRecentMergedPullRequests(pullRequests) {
  return [...pullRequests]
    .sort((a, b) => {
      return (
        new Date(b.pullRequest.mergedAt) - new Date(a.pullRequest.mergedAt) ||
        a.login.localeCompare(b.login)
      );
    })
    .slice(0, recentMergedPrLimit);
}

const manualStartMarker = "<!-- BEGIN MANUAL -->";
const manualEndMarker = "<!-- END MANUAL -->";
const defaultSiteUrl = "https://champions-list.vercel.app";

function getVisibleContributors(contributors, overridesFile) {
  const overrides = overridesFile?.contributors ?? {};
  return contributors.filter((contributor) => !overrides[contributor.githubUserId]?.hidden);
}

function renderReadmeTeaser({ contributorCount, totalMergedPrs, repoCount, generatedAt, previewHandles }) {
  return `# OpenHands Champions\n\nOpenHands Champions is the public contributor directory for everyone who has landed a merged pull request in an OpenHands public repository.\n\nThis repository powers a lightweight, searchable contributor directory that:\n- tracks merged PR contributors across OpenHands public repos\n- preserves a stable GitHub user ID alongside current GitHub profile metadata\n- supports self-serve overrides for name, note, and visibility\n- highlights recent community momentum through newest contributors and fresh merges\n\n## Contributor Directory\n\nThe directory currently shows **${contributorCount}** visible contributors across **${repoCount}** public repos, representing **${totalMergedPrs}** merged PRs.\n\nA few recently active contributors: ${previewHandles.length ? previewHandles.map((handle) => `@${handle}`).join(", ") : "sync pending"}.\n\nThe full searchable directory lives in the app in this repository. Want to add your full name, add a note about what you worked on, or hide your public entry? Open a PR using the templates in ` + "`.github/PULL_REQUEST_TEMPLATE/`" + ` or edit ` + "`data/contributors.overrides.json`" + `.\n\n_Last synced: ${generatedAt}_\n`;
}

function renderContributorWallSection(siteUrl, version) {
  const normalizedSiteUrl = siteUrl.replace(/\/+$/, "");
  const wallUrl = `${normalizedSiteUrl}/contributor-wall.svg?v=${encodeURIComponent(version)}`;

  return `## Contributor Wall\n\n<img src="${wallUrl}" alt="OpenHands Champions contributor avatar wall" />\n`;
}

function extractManualSection(existingReadme) {
  const startIndex = existingReadme.indexOf(manualStartMarker);
  const endIndex = existingReadme.indexOf(manualEndMarker);

  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    return null;
  }

  const section = existingReadme.slice(startIndex, endIndex + manualEndMarker.length);
  return `${section.trim()}\n`;
}

async function loadManualSection() {
  try {
    const existing = await fs.readFile(readmePath, "utf8");
    return extractManualSection(existing) ?? "";
  } catch {
    return "";
  }
}

function clampInt(value, min, max, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, parsed));
}

function escapeAttribute(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function withAvatarSize(avatarUrl, size) {
  try {
    const url = new URL(avatarUrl);
    url.searchParams.set("s", String(size));
    return url.toString();
  } catch {
    return avatarUrl;
  }
}

async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length);
  let index = 0;

  async function worker() {
    while (true) {
      const currentIndex = index;
      index += 1;

      if (currentIndex >= items.length) {
        return;
      }

      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }

  const workerCount = Math.min(items.length, limit);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  return results;
}

const placeholderAvatarDataUri = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";

async function fetchAvatarDataUri(avatarUrl) {
  try {
    const response = await fetch(avatarUrl, {
      headers: {
        "User-Agent": "OpenHands Champions Sync",
      },
    });

    if (!response.ok) {
      console.warn(`Avatar request failed (${response.status}): ${avatarUrl}`);
      return placeholderAvatarDataUri;
    }

    const contentType = response.headers.get("content-type")?.split(";")[0] ?? "image/png";
    const buffer = Buffer.from(await response.arrayBuffer());

    return `data:${contentType};base64,${buffer.toString("base64")}`;
  } catch (error) {
    console.warn(`Avatar request errored: ${avatarUrl}`, error);
    return placeholderAvatarDataUri;
  }
}

function renderContributorWallSvg({
  avatarDataUris,
  avatarSize,
  gap,
  maxWidth,
}) {
  const stride = avatarSize + gap;
  const maxColumnsByWidth = Math.max(1, Math.floor((maxWidth + gap) / stride));
  const columns = Math.min(maxColumnsByWidth, Math.max(1, avatarDataUris.length));
  const rows = Math.max(1, Math.ceil(avatarDataUris.length / columns));
  const width = columns * stride - gap;
  const height = rows * stride - gap;
  const radius = avatarSize / 2;

  const defs = avatarDataUris
    .map((_, index) => {
      const x = (index % columns) * stride + radius;
      const y = Math.floor(index / columns) * stride + radius;

      return `    <clipPath id="clip-${index}">\n      <circle cx="${x}" cy="${y}" r="${radius}" />\n    </clipPath>`;
    })
    .join("\n");

  const images = avatarDataUris
    .map((dataUri, index) => {
      const x = (index % columns) * stride;
      const y = Math.floor(index / columns) * stride;
      const src = escapeAttribute(dataUri);

      return `  <image href="${src}" x="${x}" y="${y}" width="${avatarSize}" height="${avatarSize}" clip-path="url(#clip-${index})" preserveAspectRatio="xMidYMid slice" />`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img">\n  <rect width="100%" height="100%" fill="transparent" />\n  <defs>\n${defs}\n  </defs>\n${images}\n</svg>\n`;
}

async function writeContributorWallAsset(contributors) {
  const avatarSize = clampInt(process.env.WALL_AVATAR_SIZE, 12, 48, 22);
  const gap = clampInt(process.env.WALL_GAP, 0, 12, 2);
  const maxWidth = clampInt(process.env.WALL_MAX_WIDTH, 240, 4000, 1000);
  const fetchScale = clampInt(process.env.WALL_FETCH_SCALE, 1, 6, 2);
  const concurrency = clampInt(process.env.WALL_CONCURRENCY, 1, 25, 10);

  const avatarUrls = contributors.map((contributor) => withAvatarSize(contributor.avatarUrl, avatarSize * fetchScale));
  const avatarDataUris = await mapWithConcurrency(avatarUrls, concurrency, fetchAvatarDataUri);

  await fs.mkdir(publicDir, { recursive: true });

  const svg = renderContributorWallSvg({
    avatarDataUris,
    avatarSize,
    gap,
    maxWidth,
  });

  await fs.writeFile(contributorWallPath, svg);
}

async function main() {
  const overridesFile = await readJson(overridesPath);
  const generatedAt = new Date().toISOString();
  const version = generatedAt.slice(0, 10);

  let contributorList;
  let visibleContributors;
  let visibleMergedPrs;
  let repoCount;

  if (useExistingData) {
    const existing = await readJson(generatedPath);

    contributorList = existing.contributors ?? [];
    visibleContributors = getVisibleContributors(contributorList, overridesFile);
    visibleMergedPrs = visibleContributors.reduce(
      (total, contributor) => total + contributor.totalMergedPrs,
      0
    );
    repoCount = existing.scannedRepoCount ?? existing.repoCount ?? 0;
  } else {
    const excludedLoginsFile = await readJson(excludedPath);
    const excludedLogins = new Set(
      (excludedLoginsFile.logins ?? []).map((entry) => normalizeLogin(entry.login))
    );

    const repos = await fetchPublicRepos();
    const contributors = new Map();
    const recentMergedPullRequests = [];
    const skippedRepos = [];
    let totalMergedPrs = 0;

    for (const repo of repos) {
      try {
        const pullRequests = await fetchMergedPullRequests(repo.name);
        for (const pullRequest of pullRequests) {
          if (shouldSkipAuthor(pullRequest.author, excludedLogins)) {
            continue;
          }

          totalMergedPrs += 1;
          updateContributor(contributors, repo.name, pullRequest);
          recentMergedPullRequests.push(summarizeRecentMergedPullRequest(repo.name, pullRequest));
        }
      } catch (error) {
        skippedRepos.push({
          repo: repo.name,
          reason: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    contributorList = sortContributors(Array.from(contributors.values()));
    const recentMergedPrs = sortRecentMergedPullRequests(recentMergedPullRequests);
    visibleContributors = getVisibleContributors(contributorList, overridesFile);
    visibleMergedPrs = visibleContributors.reduce(
      (total, contributor) => total + contributor.totalMergedPrs,
      0
    );
    repoCount = repos.length - skippedRepos.length;

    const payload = {
      generatedAt,
      organization: org,
      repoCount: repos.length,
      scannedRepoCount: repoCount,
      totalMergedPrs,
      skippedRepos,
      recentMergedPrs,
      contributors: contributorList,
    };

    await fs.writeFile(generatedPath, `${JSON.stringify(payload, null, 2)}\n`);
  }

  await writeContributorWallAsset(visibleContributors);

  const previewHandles = visibleContributors.slice(0, 6).map((contributor) => contributor.login);
  const manualSection = (await loadManualSection()).trim();
  const siteUrl = process.env.SITE_URL ?? defaultSiteUrl;

  const parts = [
    renderReadmeTeaser({
      contributorCount: visibleContributors.length,
      totalMergedPrs: visibleMergedPrs,
      repoCount,
      generatedAt: version,
      previewHandles,
    }).trim(),
    manualSection,
    renderContributorWallSection(siteUrl, version).trim(),
  ].filter((section) => section.length > 0);

  const readme = `${parts.join("\n\n")}\n`;
  await fs.writeFile(readmePath, readme);

  console.log(`Synced ${contributorList.length} contributors across ${repoCount} repos.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
