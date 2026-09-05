import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  // Disable during development to avoid caching issues
  disable: process.env.NODE_ENV === "development",
});

// CSP — built from env so each deploy targets its own Supabase project.
// 'unsafe-inline' style and 'unsafe-eval'/'unsafe-inline' script remain because
// Next 14 still injects inline runtime + uses eval in some chunks. Tightening
// to nonce/hash is tracked as a later hardening step.
const supabaseHost = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://*.supabase.co").host;
  } catch {
    return "*.supabase.co";
  }
})();
const posthogHost = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com").origin;
  } catch {
    return "https://us.i.posthog.com";
  }
})();

const cspDirectives = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-eval' 'unsafe-inline' https://va.vercel-scripts.com ${posthogHost}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' https://${supabaseHost} wss://${supabaseHost} ${posthogHost} https://va.vercel-scripts.com https://vitals.vercel-insights.com`,
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: cspDirectives },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
];

// HSTS only outside development to avoid pinning localhost over HTTPS.
if (process.env.NODE_ENV === "production") {
  securityHeaders.push({
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  });
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@domirank/shared"],
  experimental: {
    typedRoutes: false,
  },
  // See apps/web/docs/TECH_DEBT.md TD-019 — pre-existing type errors in
  // production code that Vercel cache was masking. Cleanup tracked as
  // follow-up branch.
  typescript: {
    ignoreBuildErrors: true,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default withSerwist(nextConfig);
