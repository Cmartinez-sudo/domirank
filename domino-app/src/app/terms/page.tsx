import Link from "next/link";

export const metadata = { title: "Términos · DomiRank" };

export default function TermsPage() {
  return (
    <article className="max-w-2xl mx-auto py-6 space-y-4">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Términos y Condiciones</h1>
        <p className="text-text-mute text-sm mt-1">Última actualización: mayo 2026</p>
      </header>

      <section className="space-y-3 text-text-dim leading-relaxed">
        <h2 className="text-xl font-semibold text-text mt-6">1. Aceptación</h2>
        <p>
          Al usar DomiRank aceptas estos términos. Si no estás de acuerdo, no uses el servicio.
          DomiRank es operado por sus titulares ("nosotros") y ofrecido tal cual, sin garantías más allá
          de las exigidas por ley.
        </p>

        <h2 className="text-xl font-semibold text-text mt-6">2. Elegibilidad</h2>
        <p>
          Debes tener al menos <strong>13 años</strong> para crear una cuenta. Si descubrimos que un
          usuario no cumple este requisito, podemos suspender la cuenta. En jurisdicciones que requieran
          mayor edad mínima (16 en EU, etc.), se aplica el límite local.
        </p>

        <h2 className="text-xl font-semibold text-text mt-6">3. Tu cuenta</h2>
        <p>
          Eres responsable de mantener segura tu contraseña y de la actividad en tu cuenta. Notifícanos
          de inmediato si sospechas de un acceso no autorizado. Una cuenta = una persona; no compartas
          credenciales.
        </p>

        <h2 className="text-xl font-semibold text-text mt-6">4. Contenido y conducta</h2>
        <p>
          No subas contenido ilegal, ofensivo o que viole derechos de terceros (imágenes con derechos de
          autor, etc.). Está prohibido manipular el rating mediante partidas falsas, conspiración o uso
          de múltiples cuentas. Las violaciones pueden resultar en suspensión o eliminación del rating.
        </p>

        <h2 className="text-xl font-semibold text-text mt-6">5. Integridad del rating</h2>
        <p>
          El sistema OpenSkill (Plackett-Luce / Weng-Lin) asume buena fe en el reporte de resultados.
          Reportar resultados falsos es violar estos términos. Tenemos derecho a anular partidas o
          recalcular ratings ante sospecha de fraude.
        </p>

        <h2 className="text-xl font-semibold text-text mt-6">6. Propiedad intelectual</h2>
        <p>
          DomiRank, su diseño, modelo de rating y marca son propiedad de sus titulares. Conservas la
          propiedad del contenido que subes (avatar, notas), pero nos otorgas licencia no exclusiva para
          mostrarlo dentro del servicio.
        </p>

        <h2 className="text-xl font-semibold text-text mt-6">7. Servicio "tal cual"</h2>
        <p>
          DomiRank se ofrece como está, sin garantías. No nos hacemos responsables de pérdidas o daños
          derivados del uso, salvo lo que la ley exija. Podemos suspender o terminar el servicio en
          cualquier momento.
        </p>

        <h2 className="text-xl font-semibold text-text mt-6">8. Cambios</h2>
        <p>
          Podemos actualizar estos términos. Te avisaremos por correo o dentro de la app con
          antelación razonable. El uso continuado tras la actualización implica aceptación.
        </p>

        <h2 className="text-xl font-semibold text-text mt-6">9. Contacto</h2>
        <p>Para preguntas sobre estos términos, escríbenos al correo de soporte del proyecto.</p>

        <div className="mt-8 pt-6 border-t border-border text-sm text-text-mute">
          Lee también nuestra <Link href="/privacy" className="text-primary hover:underline">Política de privacidad</Link>.
        </div>
      </section>
    </article>
  );
}
