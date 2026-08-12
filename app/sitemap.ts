import type { MetadataRoute } from "next";
import { getPhotographers } from "@/lib/data/photographers";

const siteUrl = "https://framelyphoto.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const photographers = await getPhotographers();

  return [
    {
      url: siteUrl,
      changeFrequency: "weekly",
      priority: 1
    },
    {
      url: `${siteUrl}/photographers`,
      changeFrequency: "daily",
      priority: 0.9
    },
    ...photographers.map((photographer) => ({
      url: `${siteUrl}/photographers/${photographer.id}`,
      changeFrequency: "weekly" as const,
      priority: 0.8
    }))
  ];
}
