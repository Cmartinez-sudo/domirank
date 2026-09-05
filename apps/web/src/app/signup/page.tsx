import Image from "next/image";
import Link from "next/link";
import { SignupForm } from "./SignupForm";

export const metadata = {
  title: "Crear cuenta gratis",
  description: "Empieza gratis en DomiRank. Registra tus partidas de dominó, sigue tu rating real y arma torneos con amigos.",
  alternates: { canonical: "/signup" },
};

export default function SignupPage() {
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
        <h1 className="text-2xl font-bold tracking-tight">Crear tu cuenta DomiRank</h1>
        <p className="text-text-dim text-sm mt-1">
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="text-primary hover:underline">
            Entrar
          </Link>
        </p>
      </div>
      <SignupForm />
    </div>
  );
}
