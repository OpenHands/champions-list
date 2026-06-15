import type { Metadata } from "next";
import { InternalMergedPrQueryClient } from "@/app/components/internal-merged-pr-query-client";
import { getContributorDirectoryData, getContributorRecords } from "@/lib/contributors";

export const metadata: Metadata = {
  title: "Internal Merged PR Queries | OpenHands Champions",
  description: "Internal query console for filtering merged PR contributors by milestone date.",
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

function sortYearsDesc(years: Iterable<string>): string[] {
  return [...new Set(years)].filter(Boolean).sort((a, b) => Number(b) - Number(a) || b.localeCompare(a));
}

export default function InternalMergedPrQueryPage() {
  const directoryData = getContributorDirectoryData();
  const contributors = getContributorRecords({ includeHidden: true });
  const availableYears = sortYearsDesc(contributors.flatMap((contributor) => contributor.contributionYears));
  const totalMergedPrs = contributors.reduce((total, contributor) => total + contributor.totalMergedPrs, 0);
  const hiddenContributorCount = contributors.filter((contributor) => contributor.hidden).length;

  return (
    <InternalMergedPrQueryClient
      data={{
        generatedAt: directoryData.generatedAt,
        organization: directoryData.organization,
        repoCount: directoryData.repoCount,
        scannedRepoCount: directoryData.scannedRepoCount,
        totalMergedPrs,
        hiddenContributorCount,
        visibleContributorCount: contributors.length - hiddenContributorCount,
        availableYears,
        contributors,
      }}
    />
  );
}
