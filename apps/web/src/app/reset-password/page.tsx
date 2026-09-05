import { ResetForm } from "./ResetForm";

export const metadata = { title: "Nueva contraseña · DomiRank" };

export default function ResetPasswordPage() {
  return (
    <div className="max-w-md mx-auto py-6">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Nueva contraseña</h1>
        <p className="text-text-dim text-sm mt-1">Define una contraseña segura.</p>
      </div>
      <ResetForm />
    </div>
  );
}
