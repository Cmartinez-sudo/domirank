import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Topnav } from "@/components/landing/Topnav";
import { Hero } from "@/components/landing/Hero";
import { Features } from "@/components/landing/Features";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Modalities } from "@/components/landing/Modalities";
import { FAQ } from "@/components/landing/FAQ";
import { FinalCTA } from "@/components/landing/FinalCTA";
import { Footer } from "@/components/landing/Footer";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Ranking oficial de dominó por modalidad",
  description:
    "Registra partidas, sigue tu rating real y arma torneos en Venezolano, Dominicano, Cubano y Puertorriqueño. Gratis. Instala la PWA en tu teléfono.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "DomiRank · Ranking oficial de dominó por modalidad",
    description:
      "Registra partidas, compite con tus amigos y arma torneos con rating real por modalidad.",
    url: "/",
    siteName: "DomiRank",
    locale: "es_LA",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "DomiRank · Ranking oficial de dominó",
    description:
      "Registra partidas, compite con tus amigos y arma torneos con rating real por modalidad.",
  },
};

export default async function HomePage() {
  // Si ya está autenticado, va directo al dashboard. El landing es solo para
  // visitantes que aún no tienen cuenta.
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        name: "DomiRank",
        url: "https://domirank.app",
        logo: "https://domirank.app/branding/logo-vertical-tagline.svg",
      },
      {
        "@type": "WebSite",
        name: "DomiRank",
        url: "https://domirank.app",
        inLanguage: "es",
      },
    ],
  };

  return (
    <div className="min-h-screen flex flex-col bg-bg">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-black focus:rounded-lg"
      >
        Ir al contenido
      </a>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Topnav />
      <main id="main" className="flex-1">
        <Hero />
        <Features />
        <HowItWorks />
        <Modalities />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
