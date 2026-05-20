import Link from "next/link";

export const metadata = { title: "Privacidad · DomiRank" };

export default function PrivacyPage() {
  return (
    <article className="max-w-2xl mx-auto py-6 space-y-4">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Política de Privacidad</h1>
        <p className="text-text-mute text-sm mt-1">Última actualización: mayo 2026</p>
      </header>

      <section className="space-y-3 text-text-dim leading-relaxed">
        <h2 className="text-xl font-semibold text-text mt-6">1. Qué datos guardamos</h2>
        <p>
          Para que DomiRank funcione, guardamos: tu correo, nombre, fecha de nacimiento, país, avatar
          (opcional), historial de partidas, pollas, amigos, y los datos derivados del rating (μ, σ por
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
          son privados. Pollas marcadas como "privadas" solo las ven sus participantes; las "de amigos"
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

        <h2 className="text-xl font-semibold text-text mt-6">6. Cookies y sesión</h2>
        <p>
          Usamos cookies estrictamente necesarias para mantener tu sesión iniciada (Supabase Auth). No
          usamos cookies de tracking de terceros ni analítica que comparta tus datos con anunciantes.
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
