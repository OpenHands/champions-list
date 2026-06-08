import { DirectoryClient } from "@/app/components/directory-client";
import { getContributorDirectoryData } from "@/lib/contributors";

export default function HomePage() {
  const data = getContributorDirectoryData();

  return <DirectoryClient data={data} />;
}
