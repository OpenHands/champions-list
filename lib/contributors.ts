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

export interface GeneratedContributorsFile {
  generatedAt: string | null;
  organization: string;
  repoCount: number;
  scannedRepoCount: number;
  totalMergedPrs: number;
  skippedRepos: Array<{ repo: string; reason: string }>;
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

export interface ContributorDirectoryData {
  generatedAt: string | null;
  organization: string;
  repoCount: number;
  scannedRepoCount: number;
  totalMergedPrs: number;
  hiddenContributorCount: number;
  visibleContributorCount: number;
  contributors: ContributorRecord[];
}

function normalizeText(value: string | undefined): string {
  return value?.trim() ?? "";
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
