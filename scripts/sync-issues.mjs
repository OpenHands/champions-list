import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const dataDir = path.join(rootDir, "data");
const generatedPath = path.join(dataDir, "issues.generated.json");
const excludedPath = path.join(dataDir, "excluded-logins.json");

const apiBaseUrl = "https://api.github.com";
const org = process.env.GITHUB_ORG ?? "OpenHands";
const token = process.env.GITHUB_TOKEN;
const recentActivityLimit = Math.max(1, Number(process.env.RECENT_ISSUE_ACTIVITY_LIMIT ?? "60"));
const windowEnd = new Date();
const windowStart = new Date(windowEnd.getTime() - 365 * 24 * 60 * 60 * 1000);

if (!token) {
  throw new Error("GITHUB_TOKEN is required to sync issue champions.");
}

const requestHeaders = {
  Accept: "application/vnd.github+json",
  Authorization: `Bearer ${token}`,
  "User-Agent": "OpenHands Champions Issue Sync",
  "X-GitHub-Api-Version": "2022-11-28",
};

async function readJson(filePath) {
  const content = await fs.readFile(filePath, "utf8");
  return JSON.parse(content);
}

async function githubJson(url) {
  const response = await fetch(url, { headers: requestHeaders });

  if (!response.ok) {
    const errorText = (await response.text()).slice(0, 500);
    throw new Error(`GitHub request failed with ${response.status}: ${errorText}`);
  }

  return response.json();
}

async function githubPaginate(pathname, searchParams = {}) {
  const items = [];
  let page = 1;

  while (true) {
    const url = new URL(pathname, apiBaseUrl);

    for (const [key, value] of Object.entries(searchParams)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }

    url.searchParams.set("per_page", "100");
    url.searchParams.set("page", String(page));

    const response = await fetch(url, { headers: requestHeaders });
    if (!response.ok) {
      const errorText = (await response.text()).slice(0, 500);
      throw new Error(`GitHub request failed with ${response.status}: ${errorText}`);
    }

    const payload = await response.json();
    if (!Array.isArray(payload)) {
      throw new Error(`Expected an array response from ${url}`);
    }

    items.push(...payload);

    if (payload.length < 100) {
      break;
    }

    page += 1;
  }

  return items;
}

async function fetchPublicRepos() {
  const repos = await githubPaginate(`/orgs/${org}/repos`, {
    type: "public",
    sort: "full_name",
    direction: "asc",
  });

  return repos.map((repo) => ({
    name: repo.name,
    isArchived: Boolean(repo.archived),
    isFork: Boolean(repo.fork),
  }));
}

function normalizeLogin(login) {
  return login.trim().toLowerCase();
}

function shouldSkipActor(actor, excludedLogins) {
  if (!actor?.login || !actor?.id) {
    return true;
  }

  const login = normalizeLogin(actor.login);
  if (excludedLogins.has(login)) {
    return true;
  }

  if (actor.type !== "User") {
    return true;
  }

  if (login.endsWith("[bot]")) {
    return true;
  }

  return false;
}

function summarizeIssue(repoName, issue) {
  return {
    repo: repoName,
    number: issue.number,
    title: issue.title,
    url: issue.html_url,
    createdAt: issue.created_at,
  };
}

function sortIssueChampions(users) {
  return [...users].sort((a, b) => {
    return (
      new Date(b.mostRecentActivityAt) - new Date(a.mostRecentActivityAt) ||
      b.issuesOpenedCount + b.issueCommentsCount - (a.issuesOpenedCount + a.issueCommentsCount) ||
      b.issueCommentsCount - a.issueCommentsCount ||
      b.issuesOpenedCount - a.issuesOpenedCount ||
      a.login.localeCompare(b.login)
    );
  });
}

function sortRecentActivities(activities) {
  return [...activities]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt) || a.login.localeCompare(b.login))
    .slice(0, recentActivityLimit);
}

function getOrCreateIssueChampion(champions, actor) {
  const githubUserId = String(actor.id);
  const current = champions.get(githubUserId) ?? {
    githubUserId,
    login: actor.login,
    avatarUrl: actor.avatar_url,
    profileUrl: actor.html_url,
    issuesOpenedCount: 0,
    issueCommentsCount: 0,
    firstActivityAt: null,
    mostRecentActivityAt: null,
    firstIssue: null,
    mostRecentIssue: null,
    mostRecentComment: null,
  };

  current.login = actor.login;
  current.avatarUrl = actor.avatar_url;
  current.profileUrl = actor.html_url;

  champions.set(githubUserId, current);
  return current;
}

function trackActivityBounds(champion, createdAt) {
  if (!champion.firstActivityAt || new Date(createdAt) < new Date(champion.firstActivityAt)) {
    champion.firstActivityAt = createdAt;
  }

  if (!champion.mostRecentActivityAt || new Date(createdAt) > new Date(champion.mostRecentActivityAt)) {
    champion.mostRecentActivityAt = createdAt;
  }
}

function trackOpenedIssue(champion, issueSummary) {
  champion.issuesOpenedCount += 1;
  trackActivityBounds(champion, issueSummary.createdAt);

  if (!champion.firstIssue || new Date(issueSummary.createdAt) < new Date(champion.firstIssue.createdAt)) {
    champion.firstIssue = issueSummary;
  }

  if (!champion.mostRecentIssue || new Date(issueSummary.createdAt) > new Date(champion.mostRecentIssue.createdAt)) {
    champion.mostRecentIssue = issueSummary;
  }
}

function trackIssueComment(champion, commentReference) {
  champion.issueCommentsCount += 1;
  trackActivityBounds(champion, commentReference.createdAt);

  if (!champion.mostRecentComment || new Date(commentReference.createdAt) > new Date(champion.mostRecentComment.createdAt)) {
    champion.mostRecentComment = commentReference;
  }
}

function trackYearlyTotals(yearlyTotals, createdAt, type, githubUserId) {
  const year = String(new Date(createdAt).getUTCFullYear());
  const current = yearlyTotals.get(year) ?? {
    issuesOpened: 0,
    issueComments: 0,
    uniqueIssueOpeners: new Set(),
    uniqueCommenters: new Set(),
  };

  if (type === "issueOpened") {
    current.issuesOpened += 1;
    current.uniqueIssueOpeners.add(githubUserId);
  } else {
    current.issueComments += 1;
    current.uniqueCommenters.add(githubUserId);
  }

  yearlyTotals.set(year, current);
}

function serializeYearlyTotals(yearlyTotals) {
  return Object.fromEntries(
    [...yearlyTotals.entries()]
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([year, totals]) => [
        year,
        {
          issuesOpened: totals.issuesOpened,
          issueComments: totals.issueComments,
          uniqueIssueOpeners: totals.uniqueIssueOpeners.size,
          uniqueCommenters: totals.uniqueCommenters.size,
        },
      ])
  );
}

function issueCacheKey(repoName, issueNumber) {
  return `${repoName}#${issueNumber}`;
}

function parseIssueNumber(issueUrl) {
  const url = new URL(issueUrl);
  return Number.parseInt(url.pathname.split("/").pop() ?? "", 10);
}

async function getIssueInfo(repoName, issueUrl, issueInfoCache) {
  const issueNumber = parseIssueNumber(issueUrl);
  const cacheKey = issueCacheKey(repoName, issueNumber);

  if (issueInfoCache.has(cacheKey)) {
    return issueInfoCache.get(cacheKey);
  }

  const issue = await githubJson(issueUrl);
  const info = {
    isPullRequest: Boolean(issue.pull_request),
    summary: summarizeIssue(repoName, issue),
  };

  issueInfoCache.set(cacheKey, info);
  return info;
}

async function main() {
  const excludedLoginsFile = await readJson(excludedPath);
  const excludedLogins = new Set((excludedLoginsFile.logins ?? []).map((entry) => normalizeLogin(entry.login)));
  const repos = await fetchPublicRepos();
  const issueChampions = new Map();
  const issueInfoCache = new Map();
  const recentActivities = [];
  const skippedRepos = [];
  const repoMetadata = [];
  const yearlyTotals = new Map();

  let totalIssuesOpened = 0;
  let totalIssueComments = 0;

  for (const repo of repos) {
    try {
      const issues = await githubPaginate(`/repos/${org}/${repo.name}/issues`, {
        state: "all",
        since: windowStart.toISOString(),
        sort: "updated",
        direction: "desc",
      });
      const comments = await githubPaginate(`/repos/${org}/${repo.name}/issues/comments`, {
        since: windowStart.toISOString(),
      });

      const repoEntry = {
        repo: repo.name,
        isArchived: repo.isArchived,
        isFork: repo.isFork,
        issuesOpenedCount: 0,
        issueCommentsCount: 0,
      };

      for (const issue of issues) {
        if (issue.pull_request) {
          continue;
        }

        if (new Date(issue.created_at) < windowStart) {
          continue;
        }

        issueInfoCache.set(issueCacheKey(repo.name, issue.number), {
          isPullRequest: false,
          summary: summarizeIssue(repo.name, issue),
        });

        if (shouldSkipActor(issue.user, excludedLogins)) {
          continue;
        }

        const champion = getOrCreateIssueChampion(issueChampions, issue.user);
        const issueSummary = summarizeIssue(repo.name, issue);

        trackOpenedIssue(champion, issueSummary);
        trackYearlyTotals(yearlyTotals, issue.created_at, "issueOpened", champion.githubUserId);

        totalIssuesOpened += 1;
        repoEntry.issuesOpenedCount += 1;
        recentActivities.push({
          type: "issueOpened",
          githubUserId: champion.githubUserId,
          login: champion.login,
          avatarUrl: champion.avatarUrl,
          profileUrl: champion.profileUrl,
          createdAt: issue.created_at,
          issue: issueSummary,
        });
      }

      for (const comment of comments) {
        if (new Date(comment.created_at) < windowStart) {
          continue;
        }

        if (shouldSkipActor(comment.user, excludedLogins)) {
          continue;
        }

        let issueInfo;
        try {
          issueInfo = await getIssueInfo(repo.name, comment.issue_url, issueInfoCache);
        } catch (error) {
          console.warn(
            `Skipping comment lookup for ${repo.name}: ${error instanceof Error ? error.message : "Unknown error"}`
          );
          continue;
        }

        if (issueInfo.isPullRequest) {
          continue;
        }

        const champion = getOrCreateIssueChampion(issueChampions, comment.user);
        const commentReference = {
          ...issueInfo.summary,
          commentUrl: comment.html_url,
          createdAt: comment.created_at,
        };

        trackIssueComment(champion, commentReference);
        trackYearlyTotals(yearlyTotals, comment.created_at, "issueComment", champion.githubUserId);

        totalIssueComments += 1;
        repoEntry.issueCommentsCount += 1;
        recentActivities.push({
          type: "issueComment",
          githubUserId: champion.githubUserId,
          login: champion.login,
          avatarUrl: champion.avatarUrl,
          profileUrl: champion.profileUrl,
          createdAt: comment.created_at,
          issue: issueInfo.summary,
          commentUrl: comment.html_url,
        });
      }

      repoMetadata.push(repoEntry);
    } catch (error) {
      skippedRepos.push({
        repo: repo.name,
        reason: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    windowStart: windowStart.toISOString(),
    windowEnd: windowEnd.toISOString(),
    organization: org,
    repoCount: repos.length,
    scannedRepoCount: repoMetadata.length,
    totalIssuesOpened,
    totalIssueComments,
    skippedRepos,
    repos: repoMetadata.sort((a, b) => a.repo.localeCompare(b.repo)),
    recentActivities: sortRecentActivities(recentActivities),
    yearlyTotals: serializeYearlyTotals(yearlyTotals),
    users: sortIssueChampions(Array.from(issueChampions.values())),
  };

  await fs.writeFile(generatedPath, `${JSON.stringify(payload, null, 2)}\n`);

  console.log(
    `Synced ${payload.users.length} issue champions across ${payload.scannedRepoCount} repos (${payload.totalIssuesOpened} issues, ${payload.totalIssueComments} comments).`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
