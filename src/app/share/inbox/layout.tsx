import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Shared with me · Sift",
  robots: { index: false, follow: false },
};

export default function ShareInboxLayout({ children }: { children: React.ReactNode }) {
  return children;
}
