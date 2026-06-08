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

const org = process.env.GITHUB_ORG ?? "OpenHands";
const token = process.env.GITHUB_TOKEN;

if (!token) {
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

function getVisibleContributors(contributors, overridesFile) {
  const overrides = overridesFile?.contributors ?? {};
  return contributors.filter((contributor) => !overrides[contributor.githubUserId]?.hidden);
}

function renderReadmeTeaser({ contributorCount, totalMergedPrs, repoCount, generatedAt, previewHandles }) {
  return `# OpenHands Champions\n\nCelebrating everyone who has landed a merged PR in OpenHands public repositories.\n\n## Hackers\n\nThis section stays intentionally manual. Open a PR when you want to add or update featured hackers.\n\n## Testers\n\nThis section stays intentionally manual. Open a PR when you want to add or update featured testers.\n\n## All Contributors\n\nOpenHands currently has **${contributorCount}** visible merged-PR contributors across **${repoCount}** public repos, representing **${totalMergedPrs}** merged PRs.\n\nA few recently active contributors: ${previewHandles.length ? previewHandles.map((handle) => `@${handle}`).join(", ") : "sync pending"}.\n\nThe full searchable directory lives in the Vercel app in this repository. Want to add your full name, a note about what you worked on, or hide your public entry? Open a PR editing ` + "`data/contributors.overrides.json`" + `.\n\n_Last synced: ${generatedAt}_\n`;
}

async function main() {
  const [excludedLoginsFile, overridesFile] = await Promise.all([
    readJson(excludedPath),
    readJson(overridesPath),
  ]);
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

  const contributorList = sortContributors(Array.from(contributors.values()));
  const recentMergedPrs = sortRecentMergedPullRequests(recentMergedPullRequests);
  const visibleContributors = getVisibleContributors(contributorList, overridesFile);
  const visibleMergedPrs = visibleContributors.reduce(
    (total, contributor) => total + contributor.totalMergedPrs,
    0
  );
  const generatedAt = new Date().toISOString();

  const payload = {
    generatedAt,
    organization: org,
    repoCount: repos.length,
    scannedRepoCount: repos.length - skippedRepos.length,
    totalMergedPrs,
    skippedRepos,
    recentMergedPrs,
    contributors: contributorList,
  };

  await fs.writeFile(generatedPath, `${JSON.stringify(payload, null, 2)}\n`);

  const previewHandles = visibleContributors.slice(0, 6).map((contributor) => contributor.login);
  const readme = renderReadmeTeaser({
    contributorCount: visibleContributors.length,
    totalMergedPrs: visibleMergedPrs,
    repoCount: payload.scannedRepoCount,
    generatedAt: generatedAt.slice(0, 10),
    previewHandles,
  });

  await fs.writeFile(readmePath, readme);

  console.log(`Synced ${contributorList.length} contributors across ${payload.scannedRepoCount} repos.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
