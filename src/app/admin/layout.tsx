import type { Metadata } from "next";

// Admin tools must never appear in search results. Vercel.json adds an
// X-Robots-Tag header on the response too — defense in depth.
export const metadata: Metadata = {
  title: "Admin · Sift",
  robots: { index: false, follow: false, nocache: true, noarchive: true },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
