import type { MetadataRoute } from "next";

const SITE_URL = "https://domirank.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/dashboard",
          "/profile/",
          "/matches/",
          "/tournaments/",
          "/friends",
          "/settings",
          "/onboarding",
          "/reset-password",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
