import generatedData from "@/data/issues.generated.json";
import overridesData from "@/data/contributors.overrides.json";

export interface IssueReference {
  repo: string;
  number: number;
  title: string;
  url: string;
  createdAt: string;
}

export interface IssueCommentReference extends IssueReference {
  commentUrl: string;
}

export interface GeneratedRecentIssueActivity {
  type: "issueOpened" | "issueComment";
  githubUserId: string;
  login: string;
  avatarUrl: string;
  profileUrl: string;
  createdAt: string;
  issue: IssueReference;
  commentUrl?: string;
}

export interface GeneratedIssueChampion {
  githubUserId: string;
  login: string;
  avatarUrl: string;
  profileUrl: string;
  issuesOpenedCount: number;
  issueCommentsCount: number;
  firstActivityAt: string;
  mostRecentActivityAt: string;
  firstIssue: IssueReference | null;
  mostRecentIssue: IssueReference | null;
  mostRecentComment: IssueCommentReference | null;
}

export interface YearlyIssueTotals {
  issuesOpened: number;
  issueComments: number;
  uniqueIssueOpeners: number;
  uniqueCommenters: number;
}

export interface GeneratedIssuesFile {
  generatedAt: string | null;
  windowStart: string;
  windowEnd: string;
  organization: string;
  repoCount: number;
  scannedRepoCount: number;
  totalIssuesOpened: number;
  totalIssueComments: number;
  skippedRepos: Array<{ repo: string; reason: string }>;
  repos: Array<{
    repo: string;
    isArchived: boolean;
    isFork: boolean;
    issuesOpenedCount: number;
    issueCommentsCount: number;
  }>;
  recentActivities?: GeneratedRecentIssueActivity[];
  yearlyTotals?: Record<string, YearlyIssueTotals>;
  users: GeneratedIssueChampion[];
}

interface ContributorOverride {
  name?: string;
  hidden?: boolean;
}

interface ContributorOverridesFile {
  contributors: Record<string, ContributorOverride>;
}

export interface IssueChampionRecord extends GeneratedIssueChampion {
  name: string;
  hidden: boolean;
}

export interface RecentIssueActivityRecord extends GeneratedRecentIssueActivity {
  name: string;
}

export interface IssueDirectoryData {
  generatedAt: string | null;
  windowStart: string;
  windowEnd: string;
  organization: string;
  repoCount: number;
  scannedRepoCount: number;
  hiddenChampionCount: number;
  visibleChampionCount: number;
  totalIssuesOpened: number;
  totalIssueComments: number;
  newestIssueChampions: IssueChampionRecord[];
  recentActivities: RecentIssueActivityRecord[];
  yearlyTotals: Record<string, YearlyIssueTotals>;
  users: IssueChampionRecord[];
}

function normalizeText(value: string | undefined): string {
  return value?.trim() ?? "";
}

function sortByNewestIssueChampion(a: IssueChampionRecord, b: IssueChampionRecord): number {
  return (
    new Date(b.firstActivityAt).getTime() - new Date(a.firstActivityAt).getTime() ||
    new Date(b.mostRecentActivityAt).getTime() - new Date(a.mostRecentActivityAt).getTime() ||
    a.login.localeCompare(b.login)
  );
}

function sortByRecentActivity(a: GeneratedRecentIssueActivity, b: GeneratedRecentIssueActivity): number {
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() || a.login.localeCompare(b.login);
}

export function getIssueDirectoryData(): IssueDirectoryData {
  const generated = generatedData as GeneratedIssuesFile;
  const overrides = overridesData as ContributorOverridesFile;

  const users = generated.users.map((user) => {
    const override = overrides.contributors[user.githubUserId] ?? {};

    return {
      ...user,
      name: normalizeText(override.name),
      hidden: Boolean(override.hidden),
    } satisfies IssueChampionRecord;
  });

  const visibleUsers = users.filter((user) => !user.hidden);
  const visibleUserById = new Map(visibleUsers.map((user) => [user.githubUserId, user]));

  const newestIssueChampions = [...visibleUsers].sort(sortByNewestIssueChampion);
  const recentActivities = (generated.recentActivities ?? [])
    .filter((activity) => visibleUserById.has(activity.githubUserId))
    .map((activity) => ({
      ...activity,
      name: visibleUserById.get(activity.githubUserId)?.name ?? "",
    }))
    .sort(sortByRecentActivity);

  const totalIssuesOpened = visibleUsers.reduce((total, user) => total + user.issuesOpenedCount, 0);
  const totalIssueComments = visibleUsers.reduce((total, user) => total + user.issueCommentsCount, 0);

  return {
    generatedAt: generated.generatedAt,
    windowStart: generated.windowStart,
    windowEnd: generated.windowEnd,
    organization: generated.organization,
    repoCount: generated.repoCount,
    scannedRepoCount: generated.scannedRepoCount,
    hiddenChampionCount: users.length - visibleUsers.length,
    visibleChampionCount: visibleUsers.length,
    totalIssuesOpened,
    totalIssueComments,
    newestIssueChampions,
    recentActivities,
    yearlyTotals: generated.yearlyTotals ?? {},
    users: visibleUsers,
  };
}
