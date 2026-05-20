import Link from "next/link";
import { ForgotForm } from "./ForgotForm";

export const metadata = { title: "Recuperar contraseña · DomiRank" };

export default function ForgotPasswordPage() {
  return (
    <div className="max-w-md mx-auto py-6">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Recuperar contraseña</h1>
        <p className="text-text-dim text-sm mt-1">
          Te enviamos un enlace para restablecerla.{" "}
          <Link href="/login" className="text-primary hover:underline">Volver</Link>
        </p>
      </div>
      <ForgotForm />
    </div>
  );
}
