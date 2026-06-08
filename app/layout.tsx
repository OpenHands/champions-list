import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OpenHands Champions",
  description: "A searchable directory of merged PR contributors across OpenHands public repositories.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
