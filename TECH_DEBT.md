# TECH_DEBT.md — DomiRank

## US-09 · Analytics PostHog + Speed Insights

### TD-US09-001: Opt-out endpoint incompleto

**Descripción:** El endpoint `POST /api/privacy/opt-out-analytics` solo verifica autenticación.
El opt-out real requiere:
1. Extender tabla `user_preferences` con campo `analytics_opted_out boolean DEFAULT false`.
2. Actualizar el campo en el endpoint.
3. Leer el flag en `AnalyticsProvider` y llamar `posthog.opt_out_capturing()` si está true.

**Impacto:** Medio — no hay UI de opt-out expuesta todavía, así que no hay regresión visible.

**Referencia:** `src/app/api/privacy/opt-out-analytics/route.ts`.

---

### TD-US09-002: `club_joined` pendiente de instrumentación

**Descripción:** El evento `club_joined` está definido en `EventName` (type-safe) pero no
instrumentado — el módulo de clubes no existe todavía.

**Espera:** EPIC S (módulo de clubes). Al implementar, buscar la función `requestJoinClub`
y agregar `analytics.track("club_joined", { ... })` al éxito con `status="joined"`.

**Referencia:** `src/lib/analytics.ts`, `docs/ANALYTICS_EVENTS.md`.

---

### TD-US09-003: match_finalized puede perderse si el user cierra el tab

**Descripción:** `match_finalized` se captura client-side justo antes de `router.push()`.
Si el usuario cierra el tab después de `finalizeMatch` pero antes de que PostHog flush el
evento, se pierde el track.

**Resolución sugerida:** Mover el tracking a server-side vía `posthog-node` en la server
action `finalizeMatch`, garantizando captura independiente del comportamiento del cliente.
Esto requiere instalar `posthog-node` y configurar el cliente server-side.

**Referencia:** `src/app/matches/[id]/live/LiveMatchScreen.tsx` — función `doFinalize`.

---

## Sprint UX v2 — decisiones de implementación

### Inconsistencia: spec vs rutas reales del proyecto

El spec `CLAUDE_CODE_SPRINT_V2.md` y el documento de discovery usan rutas en español:
- `/amigos` → en el proyecto es `/friends`
- `/torneos` → en el proyecto es `/tournaments`
- `/u/[username]` → en el proyecto es `/profile/[username]`

Las constantes en `src/lib/back-fallbacks.ts` usan las rutas reales (`/friends`, `/tournaments`).
Las keys del objeto `BACK_FALLBACKS` se mantienen en inglés para coherencia con el código TypeScript.

**Acción requerida:** Ninguna para este sprint. Documentado para evitar confusión futura.

---

### Decisión: Estrategia B (SecondaryPageShell vs layout group)

Se eligió **Estrategia B**: componente wrapper `SecondaryPageShell` importado en cada page secundaria.

**Alternativa descartada (Estrategia A):** Mover rutas secundarias a `src/app/(secondary)/layout.tsx`.
- Requiere mover ~10 directorios, lo que rompe imports y cambia rutas en prod.
- Mayor riesgo de regresión.

**Por qué Estrategia B:**
- No toca la estructura de carpetas existente.
- Server Components siguen siendo Server Components.
- La intención de cada page es explícita (se ve qué fallback usa).
- Más fricción al agregar pages nuevas (hay que acordarse de añadir el shell), pero eso es aceptable.

---

### Hallazgos fuera de scope (US-01) — NO arreglados

- `/como-funciona/page.tsx`: la metadata todavía dice "OpenSkill" en el título, pero el motor de rating fue migrado a Elo. Inconsistencia de copy. Requiere US separada.
- `/admin/*`: las páginas de administración no tienen ningún tipo de back navigation ni breadcrumbs. Fuera del scope de este sprint.
- AppShell.tsx topbar mobile muestra siempre el logo "DomiRank" en páginas secundarias. Con AppHeader coexistente, existe duplicación visual de headers en mobile (AppShell topbar + AppHeader de la page). Esto se puede resolver en una US futura haciendo que AppShell suprima su topbar cuando hay un AppHeader activo (por ejemplo via context o data-attribute). Anotado para sprint UX v3.
- `SecondaryPageShell` es un Server Component que renderiza `AppHeader` (Client Component). Esto es correcto en Next.js App Router (SC puede importar CC), pero `AppHeader` no puede recibir Server Components como `rightSlot` en todos los casos — solo JSX serializable. Documentado como limitación de diseño.

---

## US-02 · WizardStepLayout — decisiones de implementación

### Decisión: Step9 migrado a WizardStepLayout con forceSticky

El Step9 tenía su propio `fixed bottom-0` inline (no usaba StepFooter). Se optó por **reemplazarlo con WizardStepLayout + forceSticky=true** para mantener consistencia visual con los otros 8 pasos y eliminar el código duplicado de footer.

**Alternativa descartada:** Dejar el footer custom de Step9 como excepción.
**Razón del cambio:** La opción forceSticky produce la misma UI pero elimina 10 líneas de código manual y unifica el spinner/aria-busy.

### Decisión: el label del botón en Step9 es gestionado externamente

En Step9 el label cambia entre `"Crear torneo →"` y `"Creando torneo…"` según el estado `pending`. El componente `WizardStepLayout` ya muestra `"Procesando…"` cuando `pending=true`, por lo que se pasó `pending` en el `primaryAction` para aprovechar ese mecanismo, y el `label` prop se usa solo en estado no-pending. El texto "Creando torneo…" que aparecería como label se ignora cuando pending=true (se muestra "Procesando…"). Si se necesita un copy personalizado para el estado pending, se requiere extender la API de `primaryAction` con un campo `pendingLabel`. Anotado como mejora futura.

### Hallazgo fuera de scope (US-02) — NO arreglado

- `StepFooter` (`src/components/tournament-wizard/StepFooter.tsx`) ya no es usado por ningún paso del wizard de torneo. Puede ser eliminado en una US de limpieza. No se eliminó en este sprint para evitar romper si algún otro flujo (no identificado) lo importa.
- La detección de `contentSize` depende de `window.innerHeight` que en SSR es 0 — el componente inicia en `"large"` y se corrige en el primer ResizeObserver dispatch en el cliente. Esto es intencional para evitar CLS: el botón sticky es el estado seguro por defecto y se mueve inline cuando el contenido se mide.

---

## US-06 · Settings toggle modalidad — decisiones de implementación

### Decisión: persist skip=true incluso sin default_match_modality

El spec describe dos opciones para el caso "OFF sin default_match_modality":
a) No persistir hasta que el user elija una modalidad.
b) Persistir skip=true igual y mostrar placeholder + warning en el dropdown.

Se eligió la **opción (b)**: el toggle persiste `skip_modality_prompt=true` inmediatamente aunque no haya `default_match_modality`. El dropdown muestra placeholder "Elegir modalidad..." y un aviso `role="alert"`. La lógica de `/matches/new` (US-05) ya maneja el estado inconsistente `skip=true + modality=null` como "show step de modalidad normalmente", así que el comportamiento degradado es seguro.

**Razón:** La opción (a) requeriría estado local que "sombrea" el estado del hook (el toggle visualmente parece OFF pero la DB sigue con skip=false), lo que crea un estado temporal inconsistente más difícil de testear y de razonar.

### Decisión: skeleton visible durante loading (no hide)

Mientras `loading=true`, se muestra un skeleton de la sección con `aria-busy="true"`. El resto del settings page (perfil, notificaciones, push) no se bloquea ya que `ModalityPreferencesSection` tiene su propio loading state.

**Alternativa descartada:** Devolver `null` durante loading haría la sección aparecer/desaparecer abruptamente con potencial CLS. El skeleton es menos invasivo.

### Decisión: PrefsModalityCode como tipo local en ModalityPreferencesSection

`UserPreferences.default_match_modality` es `'ven' | 'dom' | 'cub' | 'pri' | null` (sin 'custom'). El tipo `ModalityCode` de `lib/modalidades.ts` incluye 'custom'. Se definió `PrefsModalityCode = "ven" | "dom" | "cub" | "pri"` como tipo local en lugar de exportarlo, ya que es una restricción de la feature de preferencias, no de las modalidades globales.

**Mejora futura:** Exportar `PrefsModalityCode` desde `src/types/user-preferences.ts` para reutilizarlo si otros componentes necesitan el mismo constraint.

### Hallazgo fuera de scope (US-06) — NO arreglado

- `SettingsForm.tsx` tiene su propia lógica de "modalidad por defecto del perfil" (`profile.default_modality`) desacoplada del sistema de `user_preferences`. En el futuro, cuando ambas preferencias puedan divergir, habrá que definir cuál tiene precedencia en el wizard. Anotado para sprint post-v2.
- El scroll automático al dropdown (`dropdownRef.current?.scrollIntoView`) no funciona si el usuario tiene `prefers-reduced-motion` activo. Se podría agregar la verificación `window.matchMedia('(prefers-reduced-motion: reduce)')` antes del scroll. Anotado como mejora de accesibilidad.
