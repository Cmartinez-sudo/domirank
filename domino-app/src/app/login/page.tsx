import Image from "next/image";
import Link from "next/link";
import { LoginPanel } from "./LoginPanel";

export const metadata = {
  title: "Iniciar sesión",
  description: "Entra a DomiRank para registrar partidas, ver tu ranking y unirte a torneos.",
  alternates: { canonical: "/login" },
};

export default function LoginPage() {
  return (
    <div className="max-w-md mx-auto py-6">
      <div className="text-center mb-6">
        <div className="flex justify-center mb-4">
          <Image
            src="/branding/logo-vertical.svg"
            alt="DomiRank"
            width={180}
            height={200}
            priority
            className="w-44 h-auto"
          />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Entrar a DomiRank</h1>
        <p className="text-text-dim text-sm mt-1">
          ¿No tienes cuenta?{" "}
          <Link href="/signup" className="text-primary hover:underline">
            Crear una
          </Link>
        </p>
      </div>
      <LoginPanel />
    </div>
  );
}
