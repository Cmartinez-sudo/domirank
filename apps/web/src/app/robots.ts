import type { MetadataRoute } from "next";

const SITE_URL = "https://domirank.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/como-funciona",
          "/faq",
          "/leaderboard",
          "/tournaments/formatos",
          "/login",
          "/signup",
          "/privacy",
          "/terms",
        ],
        disallow: [
          "/api/",
          "/admin",
          "/dashboard",
          "/profile/",
          "/matches/",
          "/tournaments/new",
          "/tournaments/club-pro",
          "/t/",
          "/claim/",
          "/friends",
          "/settings",
          "/onboarding",
          "/notifications",
          "/reset-password",
          "/forgot-password",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
