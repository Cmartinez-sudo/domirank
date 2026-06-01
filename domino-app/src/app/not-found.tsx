import Image from "next/image";
import Link from "next/link";

export const metadata = {
  title: "Página no encontrada · DomiRank",
};

export default function NotFound() {
  return (
    <div className="min-h-[80vh] grid place-items-center p-6 text-center">
      <div>
        <Image
          src="/branding/logo-vertical-tagline.svg"
          alt="DomiRank"
          width={200}
          height={240}
          className="w-48 mx-auto mb-6"
        />
        <h1 className="text-3xl font-bold mb-2">Página no encontrada</h1>
        <p className="text-text-mute mb-6 max-w-md mx-auto">
          La URL que abriste no existe o se movió.
        </p>
        <Link href="/dashboard" className="btn-primary">
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}
