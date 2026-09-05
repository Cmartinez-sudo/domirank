import Image from "next/image";
import Link from "next/link";

export const metadata = {
  title: "Página no encontrada",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="min-h-[80vh] grid place-items-center p-6 text-center">
      <div>
        <Image
          src="/branding/logo-vertical-tagline.svg"
          alt=""
          width={200}
          height={240}
          className="w-48 mx-auto mb-6"
        />
        <h1 className="text-3xl font-bold mb-2">Página no encontrada</h1>
        <p className="text-text-mute mb-6 max-w-md mx-auto">
          La URL que abriste no existe o se movió.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-center">
          <Link href="/" className="btn-primary">
            Empezar a jugar
          </Link>
          <Link href="/faq" className="text-text-dim hover:text-text underline underline-offset-4 text-sm">
            Ver preguntas frecuentes
          </Link>
        </div>
      </div>
    </div>
  );
}
