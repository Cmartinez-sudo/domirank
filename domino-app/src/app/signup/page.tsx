import Link from "next/link";
import { SignupForm } from "./SignupForm";

export const metadata = {
  title: "Crear cuenta · DomiRank",
};

export default function SignupPage() {
  return (
    <div className="max-w-md mx-auto py-6">
      <div className="text-center mb-6">
        <div
          className="inline-grid place-items-center w-14 h-14 rounded-2xl text-black font-extrabold text-lg mb-3"
          style={{ background: "linear-gradient(135deg,#10b981,#059669)" }}
        >
          DR
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
