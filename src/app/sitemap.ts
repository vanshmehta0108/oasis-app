import type { MetadataRoute } from "next";
import { getAllProductBarcodes } from "@/lib/db";

const BASE_URL = "https://oasis.app";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${BASE_URL}/search`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/scan`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/profile`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];

  let productPages: MetadataRoute.Sitemap = [];
  try {
    const barcodes = await getAllProductBarcodes();
    productPages = barcodes.map((barcode) => ({
      url: `${BASE_URL}/product/${barcode}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));
  } catch {
    // DB unavailable during build — skip product pages
  }

  return [...staticPages, ...productPages];
}
