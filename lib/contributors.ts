import generatedData from "@/data/contributors.generated.json";
import overridesData from "@/data/contributors.overrides.json";

export interface PullRequestSummary {
  repo: string;
  number: number;
  title: string;
  url: string;
  mergedAt: string;
}

export interface GeneratedContributor {
  githubUserId: string;
  login: string;
  avatarUrl: string;
  profileUrl: string;
  firstMergedPr: PullRequestSummary;
  mostRecentMergedPr: PullRequestSummary;
  totalMergedPrs: number;
}

export interface GeneratedRecentMergedPr {
  githubUserId: string;
  login: string;
  avatarUrl: string;
  profileUrl: string;
  pullRequest: PullRequestSummary;
}

export interface GeneratedContributorsFile {
  generatedAt: string | null;
  organization: string;
  repoCount: number;
  scannedRepoCount: number;
  totalMergedPrs: number;
  skippedRepos: Array<{ repo: string; reason: string }>;
  recentMergedPrs?: GeneratedRecentMergedPr[];
  contributors: GeneratedContributor[];
}

export interface ContributorOverride {
  name?: string;
  note?: string;
  hidden?: boolean;
}

export interface ContributorOverridesFile {
  contributors: Record<string, ContributorOverride>;
}

export interface ContributorRecord extends GeneratedContributor {
  name: string;
  note: string;
  hidden: boolean;
}

export interface RecentMergedPrRecord extends GeneratedRecentMergedPr {
  name: string;
}

export interface ContributorDirectoryData {
  generatedAt: string | null;
  organization: string;
  repoCount: number;
  scannedRepoCount: number;
  totalMergedPrs: number;
  hiddenContributorCount: number;
  visibleContributorCount: number;
  newestContributors: ContributorRecord[];
  recentMergedPrs: RecentMergedPrRecord[];
  contributors: ContributorRecord[];
}

function normalizeText(value: string | undefined): string {
  return value?.trim() ?? "";
}

function sortByNewestContributor(a: ContributorRecord, b: ContributorRecord): number {
  return (
    new Date(b.firstMergedPr.mergedAt).getTime() - new Date(a.firstMergedPr.mergedAt).getTime() ||
    new Date(b.mostRecentMergedPr.mergedAt).getTime() - new Date(a.mostRecentMergedPr.mergedAt).getTime() ||
    a.login.localeCompare(b.login)
  );
}

function sortByRecentMergedPr(a: GeneratedRecentMergedPr, b: GeneratedRecentMergedPr): number {
  return (
    new Date(b.pullRequest.mergedAt).getTime() - new Date(a.pullRequest.mergedAt).getTime() ||
    a.login.localeCompare(b.login)
  );
}

export function getContributorDirectoryData(): ContributorDirectoryData {
  const generated = generatedData as GeneratedContributorsFile;
  const overrides = overridesData as ContributorOverridesFile;

  const contributors = generated.contributors.map((contributor) => {
    const override = overrides.contributors[contributor.githubUserId] ?? {};

    return {
      ...contributor,
      name: normalizeText(override.name),
      note: normalizeText(override.note),
      hidden: Boolean(override.hidden),
    } satisfies ContributorRecord;
  });

  const visibleContributors = contributors.filter((contributor) => !contributor.hidden);
  const visibleContributorById = new Map(
    visibleContributors.map((contributor) => [contributor.githubUserId, contributor])
  );

  const newestContributors = [...visibleContributors].sort(sortByNewestContributor);
  const recentMergedPrs = (generated.recentMergedPrs ?? [])
    .filter((item) => visibleContributorById.has(item.githubUserId))
    .map((item) => ({
      ...item,
      name: visibleContributorById.get(item.githubUserId)?.name ?? "",
    }))
    .sort(sortByRecentMergedPr);

  const visibleMergedPrs = visibleContributors.reduce(
    (total, contributor) => total + contributor.totalMergedPrs,
    0
  );

  return {
    generatedAt: generated.generatedAt,
    organization: generated.organization,
    repoCount: generated.repoCount,
    scannedRepoCount: generated.scannedRepoCount,
    totalMergedPrs: visibleMergedPrs,
    hiddenContributorCount: contributors.length - visibleContributors.length,
    visibleContributorCount: visibleContributors.length,
    newestContributors,
    recentMergedPrs,
    contributors: visibleContributors,
  };
}

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}
