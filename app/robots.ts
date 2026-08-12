import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin/",
        "/dashboard/",
        "/auth/",
        "/api/",
        "/checkout/",
        "/booking/",
        "/external-booking/"
      ]
    },
    sitemap: "https://framelyphoto.com/sitemap.xml"
  };
}
