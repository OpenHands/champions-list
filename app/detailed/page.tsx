import type { Metadata } from "next";
import { DetailedMergedPrQueryClient } from "@/app/components/detailed-merged-pr-query-client";
import { getDetailedContributorDirectoryData } from "@/lib/contributors";

export const metadata: Metadata = {
  title: "Detailed PR Champions | OpenHands Champions",
  description: "A detailed, filterable public view of merged PR contributors across OpenHands repositories.",
};

export default function DetailedMergedPrQueryPage() {
  const data = getDetailedContributorDirectoryData();

  return <DetailedMergedPrQueryClient data={data} />;
}
