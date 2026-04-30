import type { Metadata } from "next";
import HomeClient from "./HomeClient";

export const metadata: Metadata = {
  title: "Sift — India's AI Food & Product Safety Scanner",
  description:
    "Scan any product to know what's really in it. Sift gives instant safety scores, ingredient breakdowns, and healthier alternatives for 1000+ Indian foods.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Sift — India's AI Food & Product Safety Scanner",
    description:
      "Scan any product to know what's really in it. Instant safety scores and healthier alternatives, made for India.",
    url: "/",
    type: "website",
  },
};

export default function Home() {
  return <HomeClient />;
}
