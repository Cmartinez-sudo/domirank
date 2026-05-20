import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-border mt-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 flex flex-col sm:flex-row gap-6 items-center justify-between text-sm">
        <Link href="/" className="flex items-center gap-2.5 font-bold tracking-tight">
          <span
            className="inline-grid place-items-center w-8 h-8 rounded-lg text-black text-xs font-extrabold"
            style={{ background: "linear-gradient(135deg,#10b981,#059669)" }}
          >
            DR
          </span>
          <span className="text-[15px]">DomiRank</span>
        </Link>

        <nav className="flex items-center gap-5 text-text-dim flex-wrap justify-center">
          <Link href="/terms" className="hover:text-text transition-colors">Términos</Link>
          <Link href="/privacy" className="hover:text-text transition-colors">Privacidad</Link>
          <Link href="/como-funciona" className="hover:text-text transition-colors">Cómo funciona</Link>
          <a href="mailto:hola@domirank.app" className="hover:text-text transition-colors">Contacto</a>
        </nav>

        <p className="text-text-mute text-xs">© 2026 DomiRank.</p>
      </div>
    </footer>
  );
}
