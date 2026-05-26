# Analytics Events — DomiRank

Taxonomía de eventos PostHog. Todos los eventos son **client-side** vía `analytics.track()`.
Implementación: `src/lib/analytics.ts` (clase `Analytics` singleton).

---

## Eventos core (instrumentados en este sprint — US-09)

### `user_signed_up`
- **Cuándo:** Tras éxito en signup form (email/password). No se dispara en OAuth (Google/Apple) ya que el redirect impide captura client-side antes de la navegación.
- **Properties:** `{ method: "email" }`
- **Lugar:** `src/app/signup/SignupForm.tsx` — bloque `onSubmit` post `r.ok`.

### `user_completed_onboarding`
- **Cuándo:** Tras guardar el onboarding exitosamente (`saveOnboarding` retorna `ok: true`).
- **Properties:** `{ steps_completed: number }` — 4 si completó todas las preguntas de nivel, 0 si saltó.
- **Lugar:** `src/app/onboarding/OnboardingForm.tsx` — función `submit`.

### `match_created`
- **Cuándo:** Tras `startLiveMatch` exitoso, antes de navegar al live match.
- **Properties:** `{ format: "singles"|"parejas", modality: string, tournament_id: string|null }`
- **Lugar:** `src/app/matches/new/NewMatchForm.tsx` — función `onSubmit`.

### `match_finalized`
- **Cuándo:** Tras `finalizeMatch` exitoso, antes de navegar al detalle del match.
- **Properties:** `{ match_id: string, winner_team: string }` — winner_team es el nombre compuesto del equipo ganador.
- **Lugar:** `src/app/matches/[id]/live/LiveMatchScreen.tsx` — función `doFinalize`.

### `match_attested`
- **Cuándo:** Tras `attestMatch` exitoso (confirm o dispute).
- **Properties:** `{ match_id: string, action: "confirm"|"dispute" }`
- **Lugar:** `src/components/match/AttestationPanel.tsx` — función `run`.

### `friend_request_sent`
- **Cuándo:** Tras `sendFriendRequest` exitoso.
- **Properties:** `{ target_user_id: string }`
- **Lugar:** `src/components/FriendActionButton.tsx` — función `onAdd`.

### `tournament_created`
- **Cuándo:** Tras `createTournament` exitoso, antes del redirect al manage.
- **Properties:** `{ format: string, modality: string, num_boards: number }`
- **Lugar:** `src/app/tournaments/new/step-9/Step9Form.tsx` — función `handleCreate`.

---

## Eventos de modalidad (instrumentados en US-09, vía US-05 TODO)

### `modality_preference_set`
- **Cuándo:** El usuario tilda "No volver a preguntar" y continúa — la preferencia se persiste en DB.
- **Properties:** `{ modality: string, skip_prompt: true }`
- **Lugar:** `src/app/matches/new/NewMatchForm.tsx` — función `handleModalityContinue`.

### `modality_override_used`
- **Cuándo:** El usuario hace click en "Cambiar" en el badge de modalidad (skip flow activo).
- **Properties:** `{ original_modality: string }`
- **Lugar:** `src/app/matches/new/NewMatchForm.tsx` — función `handleChangeModality`.

### `modality_step_skipped`
- **Cuándo:** El wizard de nueva partida arranca directamente en el step de jugadores (skip flow activo). Se dispara en mount via `useEffect`.
- **Properties:** `{ modality: string }`
- **Lugar:** `src/app/matches/new/NewMatchForm.tsx` — `useEffect([], [])` on mount.

---

## Eventos futuros (definidos en `EventName` pero NO instrumentados todavía)

### `club_joined`
- **Status:** Pendiente — el módulo de clubes no está implementado en este sprint.
- **Espera:** EPIC S (módulo de clubes).
- **Properties esperadas:** `{ club_id: string, method: "open"|"invite"|"code" }`

---

## Convenciones

- Properties usan `snake_case`.
- IDs son UUIDs como strings (no convertir).
- Timestamps NO se mandan — PostHog los agrega automáticamente.
- NO trackear PII innecesario: email/username solo en `identify()`, **nunca** en `track()`.
- El wrapper es no-op en `NODE_ENV !== production` — no contamina data de dev.
- Session replay activo con `maskAllInputs: true` para cumplir privacy.
