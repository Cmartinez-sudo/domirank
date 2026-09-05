import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Política de Privacidad",
  description:
    "Cómo DomiRank recolecta, usa y protege tus datos: cuentas Supabase, historial de partidas, analítica y tus derechos como usuario.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <article className="max-w-2xl mx-auto py-6 space-y-4">
      <header className="rounded-2xl border border-border bg-surface-2 px-5 py-4">
        <h1 className="text-3xl font-bold tracking-tight">Política de Privacidad</h1>
        <p className="text-text text-sm mt-2">
          <strong>Última actualización:</strong> 26 de agosto de 2026
        </p>
        <p className="text-text-mute text-xs mt-1">
          Entidad responsable: [CONFIRMAR: entidad legal] · Contacto:{" "}
          <a href="mailto:hola@domirank.app" className="underline">hola@domirank.app</a> ·
          Jurisdicción: [CONFIRMAR: jurisdicción]
        </p>
      </header>

      <section className="space-y-3 text-text-dim leading-relaxed">
        <h2 className="text-xl font-semibold text-text mt-6">1. Qué datos guardamos</h2>
        <p>
          Para que DomiRank funcione, guardamos: tu correo, nombre, fecha de nacimiento, país, avatar
          (opcional), historial de partidas, torneos, amigos, y los datos derivados del rating (μ, σ por
          formato). Si te autenticas con Google o Apple, recibimos tu nombre y correo de ese proveedor.
        </p>

        <h2 className="text-xl font-semibold text-text mt-6">2. Para qué los usamos</h2>
        <p>
          Para operar el servicio: identificarte, mostrar tu perfil a tus amigos, calcular tu rating,
          enviarte correos de autenticación y notificaciones del producto. No vendemos tu información a
          terceros.
        </p>

        <h2 className="text-xl font-semibold text-text mt-6">3. Qué es público</h2>
        <p>
          Tu username, nombre mostrado, avatar, país y rating son <strong>públicos</strong> dentro de DomiRank
          (cualquier usuario puede verlos en leaderboards y al buscar). Tu correo y fecha de nacimiento
          son privados. Torneos marcados como "privados" solo los ven sus participantes; los "de amigos"
          solo tus amigos; las "públicas" cualquiera.
        </p>

        <h2 className="text-xl font-semibold text-text mt-6">4. Dónde se guardan</h2>
        <p>
          Toda la información se almacena en <strong>Supabase</strong> (Postgres + Storage) en la región que
          elegimos al crear el proyecto. La conexión a la base es siempre por HTTPS. Los archivos de
          avatar viven en Supabase Storage con políticas de acceso restringido a su dueño para
          modificarlos (lectura pública).
        </p>

        <h2 className="text-xl font-semibold text-text mt-6">5. Tus derechos</h2>
        <p>
          Puedes ver y editar tu perfil en cualquier momento desde Ajustes. Para eliminar tu cuenta o
          exportar tus datos, escríbenos al correo de soporte y procesaremos la solicitud en hasta 30
          días (GDPR / ley de protección de datos local).
        </p>

        <h2 className="text-xl font-semibold text-text mt-6">6. Cookies y analítica</h2>
        <p>
          Usamos dos tipos de tecnologías de almacenamiento en tu navegador:
        </p>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong>Estrictamente necesarias:</strong> cookies para mantener tu sesión iniciada
            (Supabase Auth) y una entrada en localStorage con tu decisión sobre el banner de cookies.
            No requieren consentimiento.
          </li>
          <li>
            <strong>Analítica (PostHog):</strong> solo se carga si aceptas el banner de cookies.
            Nos ayuda a entender qué funciones se usan más y mejorar el producto. Enmascaramos
            todos los inputs de los formularios y no compartimos tus datos con anunciantes.
            Puedes retirar el consentimiento en cualquier momento desde Ajustes → Privacidad.
          </li>
        </ul>
        <p>
          No usamos cookies publicitarias de terceros ni píxeles de redes sociales.
        </p>

        <h2 className="text-xl font-semibold text-text mt-6">7. Menores</h2>
        <p>
          No aceptamos cuentas de menores de 13 años. Si descubrimos una cuenta así, la eliminamos. Los
          padres pueden contactarnos para verificar y eliminar datos.
        </p>

        <h2 className="text-xl font-semibold text-text mt-6">8. Cambios</h2>
        <p>
          Te avisaremos por correo o en la app si cambiamos la política de manera significativa.
        </p>

        <div className="mt-8 pt-6 border-t border-border text-sm text-text-mute">
          Lee también nuestros <Link href="/terms" className="text-primary hover:underline">Términos</Link>.
        </div>
      </section>
    </article>
  );
}
