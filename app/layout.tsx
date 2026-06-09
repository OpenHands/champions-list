import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OpenHands Champions",
  description:
    "Search OpenHands public-repo champions across merged PRs, issues opened, and issue comments.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
