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
  title: "DomiRank · Ranking oficial de dominó por modalidad",
  description:
    "La primera plataforma para llevar tu nivel real de dominó. Registra partidas, compite con tus amigos y arma torneos en tus modalidades favoritas: Venezolano, Dominicano, Cubano y Puertorriqueño.",
  openGraph: {
    title: "DomiRank · Ranking oficial de dominó por modalidad",
    description:
      "Registra partidas, compite con tus amigos y arma torneos con rating real por modalidad.",
    url: "https://domirank.app",
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

  return (
    <div className="min-h-screen flex flex-col bg-bg">
      <Topnav />
      <main className="flex-1">
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
