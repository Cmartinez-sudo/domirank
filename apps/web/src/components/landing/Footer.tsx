import Image from "next/image";
import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-border mt-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 flex flex-col sm:flex-row gap-6 items-center justify-between text-sm">
        <Link href="/" className="flex items-center" aria-label="DomiRank — Inicio">
          <Image
            src="/branding/logo-horizontal-tagline.svg"
            alt="DomiRank · Tu app de dominó"
            width={130}
            height={32}
            className="h-8 w-auto"
          />
        </Link>

        <nav aria-label="Enlaces del pie de página" className="flex items-center gap-5 text-text-dim flex-wrap justify-center">
          <Link href="/como-funciona" className="hover:text-text transition-colors">Cómo funciona</Link>
          <Link href="/faq" className="hover:text-text transition-colors">FAQ</Link>
          <Link href="/terms" className="hover:text-text transition-colors">Términos</Link>
          <Link href="/privacy" className="hover:text-text transition-colors">Privacidad</Link>
          <a href="mailto:hola@domirank.app" className="hover:text-text transition-colors">Contacto</a>
        </nav>

        <p className="text-text-mute text-xs">© 2026 DomiRank.</p>
      </div>
    </footer>
  );
}
