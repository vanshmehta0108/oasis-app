import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Add a product · Sift",
  description: "Submit a missing product so we can score it for the community.",
  robots: { index: false, follow: true },
};

export default function AddLayout({ children }: { children: React.ReactNode }) {
  return children;
}
