import type { Metadata } from "next";
import { IssuesDirectoryClient } from "@/app/components/issues-directory-client";
import { getIssueDirectoryData } from "@/lib/issues";

export const metadata: Metadata = {
  title: "Issue Champions | OpenHands Champions",
  description: "A searchable directory of issue creators and commenters across OpenHands public repositories.",
};

export default function IssuesPage() {
  const data = getIssueDirectoryData();

  return <IssuesDirectoryClient data={data} />;
}
