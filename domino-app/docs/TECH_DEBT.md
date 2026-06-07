# Tech Debt

Registro de deuda técnica decidida conscientemente durante el sprint.
Cada entrada referencia la US que la originó y el impacto estimado.

---

## US-05 · Skip modality prompt

### TD-001: Estado inconsistente `skip=true + modality=null`

**Descripción**: Si `skip_modality_prompt === true` pero `default_match_modality === null` en la DB
(estado que no debería ocurrir con la UI normal, pero puede surgir de ediciones directas a la DB
o de un bug futuro en US-06), el sistema actualmente cae al flow normal y loguea `console.warn`.

**Lo que falta**: Enviar alerta a Sentry con `captureMessage` (ver comentario en `NewMatchForm.tsx`).
Actualmente Sentry está integrado en el proyecto pero no se añadió el import extra para mantener
el scope de US-05 acotado.

**Impacto**: Bajo. El UX degrada gracefully (flow normal). El riesgo es que el estado inconsistente
pase silencioso en producción sin que el equipo lo note.

**Referencia**: `src/app/matches/new/NewMatchForm.tsx` — bloque `hasInconsistentPreferences`.

**Resolución sugerida**: En US-06 (Settings toggle), agregar validación server-side que prevenga
guardar `skip=true` con `modality=null`. Adicionalmente, activar el Sentry `captureMessage`.

---

### TD-002: Analytics PostHog — TODOs US-09

**Descripción**: Los 3 puntos de tracking de PostHog están marcados como comentarios `TODO US-09`
pero no están implementados. Sin analytics, no podemos medir adoption del feature.

**Ubicaciones**:
- `src/app/matches/new/NewMatchForm.tsx` línea con `handleModalityContinue` — `modality_preference_set`
- `src/app/matches/new/NewMatchForm.tsx` línea con `handleChangeModality` — `modality_override_used`
- `src/app/matches/new/NewMatchForm.tsx` players step render — `modality_step_skipped`

**Resolución**: US-09 implementará el wrapper de analytics. Buscar los `TODO US-09` en el repo.

---

### TD-003: `modality_step_skipped` no se dispara como side effect

**Descripción**: El comentario `// TODO US-09: analytics.track('modality_step_skipped', ...)` está
en el render del step de players, pero el tracking real debería estar en un `useEffect` que dispare
solo cuando `arrivedViaSkip === true` en el primer render. Actualmente el comentario está en el JSX
para marcar el punto de interés, pero no es el lugar correcto para un side effect.

**Impacto**: Cero en runtime (es solo un comentario). Al implementar US-09, mover el track a un
`useEffect(() => { if (arrivedViaSkip) track(...) }, [])`.

---

### TD-004: Migración 0034 requerida antes de que US-05 funcione en producción

**Descripción**: La tabla `user_preferences` (migración 0034) no está aplicada al momento de
implementar US-05. El sistema tiene graceful fallback: si `getUserPreferences()` falla, se asume
`skip_modality_prompt=false` (flow normal). Esto significa que US-05 está deployable sin bloqueo,
pero el feature no activará hasta que Carlos aplique la migración.

**Acción pendiente**: Carlos aplica `supabase db push` al finalizar el sprint.

---

## Sprint Reliability NR · Profile Page Polish

### TD-014: 9 implementaciones distintas de "chip/badge/pill"

**Descripción**: El audit del sprint Profile Page Polish reveló 9 patrones
de chip distintos en el codebase (`TierBadge`, `ReliabilityBadge`, `RatingBadge`,
`RankBadge`, `StreakChip`, `DayWinnerBadge`, `ModalityChips`, clase CSS
`.badge` global, y spans hardcoded inline). Cada uno define su propio
sizing/padding/radius. Resultado: heights desiguales entre chips en el
mismo stack, font-size variations sutiles, mantenimiento doble cuando
hay que cambiar el design system de chips.

**Lo que falta**: Consolidar en un `<Chip>` base con variants
(`bucket`, `reliability`, `friend`, `rank`, `streak`, etc). El base
encapsula sizing/padding/radius; las variants solo cambian color +
borde. Migrar los 9 call-sites.

**Impacto**: Medio. Hoy funciona, pero cualquier cambio de design system
de chips requiere editar 9 lugares y testear todos los surfaces.

**Acción pendiente**: PR separado post-sprint Reliability NR. Estimado:
1 día de trabajo + verificación visual en 5+ pantallas.

### TD-015: Header de rating duplicado entre dashboard y profile

**Descripción**: El bloque "DomiRank Global label + número grande +
TierBadge + ReliabilityBadge" vive inline en dashboard/page.tsx
(líneas 80-124) y profile/[username]/page.tsx (líneas 156-205). El sprint
los dejó con layouts distintos a propósito (dashboard right-aligned vs
profile center-aligned), pero gran parte del markup es idéntico.

**Lo que falta**: Extraer a `<RatingHeader profile={…} variant="dashboard" | "profile"/>`
que encapsule el render del label + número + chips + meta line.

**Impacto**: Bajo. El código funciona; el riesgo es divergencia entre los
dos cuando se cambie copy/styling sin sincronizar.

**Acción pendiente**: Hacer junto con TD-014 (chip refactor) si se decide
abordar el design system completo.

### TD-016: ModalityCard variant prop crecerá si se piden 3+ layouts

**Descripción**: `src/components/ModalityCard.tsx` expone hoy 2 variants
(`compact` para profile, `detailed` para dashboard). Si se piden más
layouts (e.g. una variante para clubes o leaderboard-row), el prop debería
splitearse en componentes separados o usar composition pattern.

**Lo que falta**: Vigilar el crecimiento. Si llegamos a 3 variants,
refactor a `<ModalityCardCompact/>`, `<ModalityCardDetailed/>`, etc, o
exponer las primitivas internas (`<ModalityHeader/>`, `<ModalityStats/>`).

**Impacto**: Bajo. Preventivo.

**Acción pendiente**: Re-evaluar cuando se pida la tercera variant.

---

## Sprint Match Cancellation · Cron not scheduled

### TD-018: auto-cancel-inactive endpoint vive sin schedule

**Descripción**: El endpoint `/api/cron/auto-cancel-inactive` se construyó
para que corra cada hora vía Vercel Cron (warning a 1h, auto-cancel a 2h,
finalize-expired-undo-windows). Pero Vercel Hobby plan limita a 2 crons
totales — los slots ya están ocupados por `auto-confirm` y
`recompute-reliability`. El endpoint quedó funcional pero sin disparador
automático.

**Impacto**: Medio. Las consecuencias del no-schedule:
- Partidas zombie (>2h sin actividad) NO se auto-cancelan; van quedando
  abiertas hasta que el dueño las cancele manualmente o se corra el
  endpoint ad-hoc.
- Warnings de 1h no se mandan.
- Undo windows expirados quedan visibles en banner ámbar más tiempo del
  necesario (técnicamente la ventana ya expiró server-side por
  `cancellation_undo_until < now()`, pero el `undo_until` no se setea
  NULL → UI sigue mostrando countdown que llegó a 0).

**Mitigaciones disponibles**:
1. **Upgrade Vercel Pro** ($20/mes) y agregar la entry a vercel.json.
2. **Cron externo** (GitHub Actions schedule, EasyCron, cron-job.org):
   HTTP GET al endpoint con `Authorization: Bearer $CRON_SECRET`.
3. **Disparo ad-hoc** cuando se detecten zombies.

**Acción pendiente**: cuando MAU crezca y aparezcan zombies reales,
priorizar upgrade Pro o configurar cron externo. Mientras tanto, el
zombie cleanup one-shot (mig 0068-0071) limpia el inventario histórico.

---
