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
