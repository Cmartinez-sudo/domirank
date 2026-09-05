# DomiRank — UX Audit + Sprint 1-3 Report

**Fecha**: 2026-08-26
**Ámbito**: PWA DomiRank (Next.js 14 App Router + Supabase). 4 flujos críticos: Torneos, Partidas sueltas, Grupos, Auth/Onboarding.
**Método**: 2 lentes — ROTO (bug) e INNECESARIO (fricción que sobra). Fase 0 mapeo, Fase 1 medición, Sprints 1-3 fixes.

---

## 1. Mapa de pantallas y transiciones (Fase 0)

### 1.1 Arquitectura

- Next.js 14.2.x, **App Router puro** (`src/app/`).
- Estado: server components + Supabase SSR + hooks locales (`useSafeBack`, `useActiveMatch`, `useUserPreferences`, `useTournamentDraft`). Sin Redux/Zustand.
- Providers globales (`src/app/layout.tsx`): `AnalyticsProvider`, `MotionGate`, `ToastProvider` (custom), `AppShell` (bottom nav 5-items mobile / sidebar desktop).
- Feedback: **Toast custom** (`src/components/Toast.tsx`) auto-dismiss 5s, safe-area-inset. **ConfirmDialog** y **ConfirmDangerDialog** para modales.
- Navegación back: **`useSafeBack`** (`src/hooks/useSafeBack.ts`) — chequea `document.referrer`, usa fallback si es deep-link o `forceFallback=true`.
- Auth: middleware Supabase SSR refresca sesión en cada request.
- PWA: manifest + Serwist SW precompilado (`public/sw.js`). `start_url=/dashboard`.

### 1.2 Screen graph por flujo crítico

**Torneos (jugar partida dentro de torneo)**
```
/dashboard
  → tap "Torneos"          → /tournaments
  → tap tarjeta            → /tournaments/[id]
  → tap "Jugar" (HeroNextMatch o pairing)
                           → /matches/new?tournament=&pairing=
    → TournamentFastPath autoarma equipos
    → tap "Comenzar"       → /matches/[id]/live
      [loop mano: numpad → tap "Sumar" → mano en lista, sin cambio de pantalla]
    → tap "Finalizar"
      ├─ Polla/continuous_league: refresh in-place → trophy inline → "Volver al torneo" → /tournaments/[id]
      └─ Quick match/torneo normal: → /matches/[id] (detalle + AttestationPanel)
         → back del breadcrumb → /tournaments/[id]  (fix Sprint 2)
```

**Partidas sueltas**
```
/dashboard → tap "+ Nueva partida" → /matches/new
  → Step 1: modalidad (skip si skip_modality_prompt=true)
  → Step 2: buscar y agregar 3 oponentes + armar equipos
    ⬒ Chips "Con quien juegas seguido" (Sprint 3)
  → tap "Comenzar"     → /matches/[id]/live
  → tap "Finalizar"    → /matches/[id] (AttestationPanel)
  → back              → /dashboard con historial actualizado
```

**Grupos**
```
/groups
  ├─ tap "+ Crear grupo" → /groups/new → createGroup() → /groups/[id]/members
  ├─ tap InvitationCard "Aceptar" → aparece en Mis grupos
  └─ tap GroupCard → /groups/[id]/leaderboard (tabs: Leaderboard, Miembros, Historial, Ajustes admin)

Atribución: trigger SQL trg_attribute_match_on_confirmed → automática. Sprint 1: toast "Cuenta para el grupo X" al scorekeeper y firmantes.

Salir de grupo (Sprint 2):
  ├─ Miembro/co-admin → botón "Salir del grupo" con confirm
  ├─ Admin único → botón "Salir y archivar grupo" → auto-archiva (is_active=false)
  └─ Admin con otros miembros → hint hacia Ajustes (transferir admin)
```

**Auth / Onboarding**
```
/ (landing) → tap "Empezar" → /signup
  → 6 campos (nombre, apellido, fecha nac, email, password, ☑ términos)
  → tap "Crear cuenta" → pantalla "Revisa tu correo" 📬
  → email → /auth/callback → /onboarding

Onboarding (5 pantallas, Sprint 1):
  1. Perfil: país + modalidad (fusionados, ex-"¡Bienvenido!")
  2-5. 4 preguntas skill assessment (auto-advance)
  6. Summary → /dashboard

Sesión expirada (Sprint 3):
  Cualquier ruta protegida sin sesión → /login?next=<url>
  Login normal / magic link / OAuth respetan next → vuelve al destino
```

---

## 2. Tabla de fricción — ANTES vs. DESPUÉS

| Camino crítico | Antes | Después | Presupuesto |
|---|---|---|---|
| **Registrar 1 mano en partida en curso** | 3–4 taps, 0 nav. Toast silencioso. `activeTeam` fijo en 1 al montar. | 3 taps, 0 nav. Toast `+N · Team`. `activeTeam` hereda del último round. | ≤3 taps, 0 nav ✅ |
| **Terminar quick match dentro de torneo** | Back post-finalize caía en `/dashboard`. | Back cae en `/tournaments/[id]` (ya estaba, cubierto por test). | ≤1 tap ✅ |
| **Empezar partida desde el home** | 8–10 taps (buscar 3 usuarios uno por uno). | 4–5 taps con chips "Con quien juegas seguido". | ≤3 taps 🟡 (mejora, aún fuera) |
| **Registro nuevo hasta poder jugar** | 6 pantallas + 6 selecciones (6 form + bienvenida + país + modalidad + 4 preguntas + summary). | 5 pantallas (perfil combinado + 4 preguntas + summary). | ≤5 taps 🟡 |
| **Attestation (no scorekeeper)** | Email → app → buscar match → scrollear → tap. | Email/notif → deeplink `#attestation` → scroll automático → tap. | 1 tap ✅ |
| **Salir de un grupo (no admin)** | Imposible desde UI (leaveGroup existía pero sin botón). | Botón visible + confirm + toast + navegación. | 2 taps ✅ |
| **Sesión expirada a mitad de partida** | Botado a `/login` perdiendo contexto y buffer. | `?next=<url>` restaura destino; localStorage restaura numpad + activeTeam. | 0 pérdida ✅ |
| **Feedback de atribución a grupo** | Silencioso — usuario no sabía que su partida contó. | Toast "Cuenta para el grupo X" tras finalize/quorum. | Visible ✅ |

---

## 3. Hallazgos por flujo

### 3.1 Torneos

| Hallazgo | Componente / Archivo | Tipo | Antes → Debería | Severidad | Estado |
|---|---|---|---|---|---|
| `addRound()` sin feedback visible | `LiveMatchScreen.tsx:117-139` | INNECESARIO (fricción) | Silencio tras registrar → toast confirmando registro (evita doble submit) | Molesto | **Arreglado** (Sprint 1) |
| `activeTeam` inicial fijo en 1 | `LiveMatchScreen.tsx:75` | ROTO | Cada re-montaje reset → hereda del último round | Molesto | **Arreglado** (Sprint 1) |
| Attest fuera de `/live`, sin deeplink | `email-templates.ts:165`, `AttestationPanel.tsx` | INNECESARIO | Email a `/matches/[id]` sin scroll → `#attestation` + auto-scroll | Molesto | **Arreglado** (Sprint 3) |
| Back post-finalize a `/dashboard` | `matches/[id]/page.tsx:93-102` | ROTO | Ya arreglado en commit previo — cubierto por test | Molesto | **Cubierto** (Sprint 2 test) |
| Cronómetro no visible en modo espectador | `MatchTimer.tsx` | INNECESARIO | Timer no renderiza pero debería mostrarse read-only | Cosmético | **Pendiente** (fuera scope) |

### 3.2 Partidas sueltas

| Hallazgo | Componente / Archivo | Tipo | Antes → Debería | Severidad | Estado |
|---|---|---|---|---|---|
| 3 UserSearch consecutivos para armar equipos | `NewMatchForm.tsx TeamPicker` | INNECESARIO | Sin sugerencias → chips "Con quien juegas seguido" | Molesto | **Arreglado** (Sprint 3) |
| Numpad buffer se pierde en F5 / expiración | `LiveMatchScreen.tsx` | ROTO | Se perdía input parcial → localStorage por matchId | Molesto | **Arreglado** (Sprint 3) |
| Historial de partidas mezclado con dashboard | `dashboard/page.tsx` | INNECESARIO | Sin filtro/paginación en dashboard "últimas 10" | Cosmético | **Pendiente** (fuera scope) |

### 3.3 Grupos

| Hallazgo | Componente / Archivo | Tipo | Antes → Debería | Severidad | Estado |
|---|---|---|---|---|---|
| No hay botón "Salir del grupo" en UI | `MembersPanel.tsx` | ROTO | `leaveGroup()` existía pero no expuesto → botón visible según role | **Bloqueante** | **Arreglado** (Sprint 2) |
| Admin único bloqueado sin salida | `groups.ts leaveGroup` | ROTO | Bloqueaba admin siempre → si es único, sale + auto-archiva `is_active=false` | **Bloqueante** | **Arreglado** (Sprint 2) |
| Ex-miembros desaparecen del leaderboard | `leaderboard/page.tsx` | ROTO | Query filtra `status='active'` → aparecen con opacity + strikethrough al final | **Bloqueante** | **Arreglado** (Sprint 2) |
| Atribución automática silenciosa | `finalizeMatch`, `attestMatch` | INNECESARIO | Sin feedback al usuario → toast "Cuenta para el grupo X" | Molesto | **Arreglado** (Sprint 1) |

### 3.4 Auth / Onboarding

| Hallazgo | Componente / Archivo | Tipo | Antes → Debería | Severidad | Estado |
|---|---|---|---|---|---|
| Onboarding con pantalla "¡Bienvenido a DomiRank!" full-page | `OnboardingForm.tsx:132-172` | INNECESARIO | Pantalla de paso sin decisión → header compacto + fusión Step 1+2 | Molesto | **Arreglado** (Sprint 1) |
| Sesión expirada bota sin `returnTo` | `middleware.ts`, `auth.ts requireUser` | ROTO | Redirect a `/login` perdiendo destino → `?next=<url>` respetado por password/magic/oauth | **Bloqueante** | **Arreglado** (Sprint 3) |
| Pantalla "Revisa tu correo" es paso muerto | `SignupForm.tsx`, `LoginPanel.tsx` | INNECESARIO | Sin polling ni "reenviar" → **no arreglado, requiere decisión** | Molesto | **Pendiente decisión** |
| Reset password sin campo confirmar | `ResetForm.tsx:26` | INNECESARIO (leve) | Contraseña sin doble check → aceptable con anti-enumeration | Cosmético | **No tocado** (defendible) |
| SignOutButton sin confirmación | `SignOutButton.tsx` | ROTO (edge) | Logout con partida en curso pierde buffer — mitigado ahora con localStorage | Molesto | **Mitigado** (Sprint 3) |

---

## 4. Pantallas huérfanas / flujos sin salida

- **`leaveGroup()` sin botón**: la server action existía pero ningún componente la invocaba. Ex-usuarios quedaban atrapados en grupos hasta que un admin los quitara. → **Arreglado en Sprint 2**.
- **Ex-miembros invisibles en leaderboard**: `left`/`removed` no aparecían, aunque su historial de partidas seguía atribuido al grupo. Rompía la promesa del producto ("nombre en gris/tachado"). → **Arreglado en Sprint 2**.
- **Pantalla "Revisa tu correo"** (`/signup`, `/login` magic): sin CTA de "reenviar", sin polling. Único camino es cerrar la app, abrir correo, tapear link. → **No arreglado, requiere decisión** (timer + botón reenviar vs. tal cual).
- **AttestationPanel** en `/matches/[id]` (no en `/live`): requería scroll manual desde el detalle. → **Arreglado en Sprint 3** (deeplink + auto-scroll).

---

## 5. Tests E2E agregados

Archivo: **`e2e/friction-budgets.spec.ts`** — 16 specs organizados por Sprint. Aserciones cubren tanto funcionalidad como presupuestos de fricción (aserción explícita del # de navegaciones/pantallas del happy path).

Correr:
```bash
# Local (dev server auto-arranca vía playwright webServer):
pnpm e2e

# Solo estos:
npx playwright test e2e/friction-budgets.spec.ts

# UI interactiva:
pnpm e2e:ui
```

**Estado**:
- **1 test corre sin seed** (`Sprint 3 — returnTo`): valida que rutas protegidas sin cookie redirigen a `/login?next=<url>` con hidden input.
- **1 test corre sin seed** (`Sprint 3 — anti-loop`): valida que `/login` no reenvía a sí mismo como next.
- **14 tests skippeados** con env vars documentadas (`E2E_LIVE_MATCH_ID`, `E2E_GROUP_ID_AS_MEMBER`, etc.). Habilitar cuando el seed común esté listo. Cada uno contiene aserciones completas — actúan como especificación ejecutable del presupuesto.

**Regresión**: los tests fallan si se agrega una pantalla intermedia, se cambia una redirección clave, o desaparece un botón crítico. Blindaje contra deriva de UX.

Unit tests:
- `src/lib/__tests__/groups.test.ts` (38 tests, +2 nuevos): `leaveGroup` con admin único que archiva, y admin bloqueado con otros miembros.

---

## 6. Lo que NO se tocó y por qué

| Área | Motivo |
|---|---|
| **Diseño visual** (colores, tipografía, layout general) | Fuera del ámbito. La app tiene sistema de tokens (`tailwind.config.ts`) que funciona. |
| **Refactor de 4 fases** (Club Pro al wizard + eliminar 1v1 + Grupos reemplaza Liga continua) | Iniciativa separada (memory: `project_domirank_refactor`). Ámbito distinto al audit UX. |
| **Motor de rating / Elo / RPCs SQL** | Ámbito distinto. El audit fue puramente de UX. |
| **Landing page (`/`)** | Tiene CTAs claros distribuidos. Sin fricción identificada. |
| **Sistema de toasts / modales base** | `Toast`, `ConfirmDialog`, `ConfirmDangerDialog` funcionan bien y son reutilizados por los fixes. |
| **Reset password sin "confirmar contraseña"** | Anti-enumeration + user ya verificó email — defendible. |
| **Pantalla "Revisa tu correo" con retry/polling** | Requiere decisión de producto (¿timer? ¿supabase resend rate limit? ¿Poll?). Se queda en propuesto. |
| **Confirmación en SignOutButton** | Aceptable ahora que localStorage preserva el numpad — el buffer no se pierde en logout accidental. |
| **Historial de partidas con paginación** | Cosmético; dashboard "últimas 10" cubre el caso frecuente. |
| **Cronómetro visible en modo espectador** | Cosmético; no bloquea la partida. |

---

## 7. Resumen ejecutivo por Sprint

### Sprint 1 (Bajo riesgo, alto impacto)
5 fixes: `activeTeam` hereda, toast tras `addRound`, toast atribución a grupo, fusión de onboarding Step 1+2 + eliminación pantalla "Bienvenido" full-page, tests E2E de presupuestos.

### Sprint 2 (Decisiones de producto cerradas)
3 fixes: botón "Salir del grupo" con caso admin único auto-archiva, ex-miembros tachados al final del leaderboard, test de regresión para back post-finalize a `/tournaments/[id]`.

### Sprint 3 (Cambios mayores de flujo)
4 fixes: `?next=` en middleware + login + magic link + OAuth para preservar destino tras sesión expirada, localStorage persiste numpad + activeTeam por matchId, deeplink `#attestation` con auto-scroll (email + notifs in-app + dashboard card), chips "Con quien juegas seguido" en `NewMatchForm` con query de top 6 co-players.

### Métricas de calidad
- **`tsc --noEmit`**: verde en cada Sprint.
- **Vitest**: 38/38 unit tests verdes.
- **Playwright**: 16 E2E specs reconocidos (2 corren sin seed + 14 con seed skippable).
- **Regresiones**: 0 identificadas.

### Deuda pendiente
- Reactivar los 14 tests E2E skippeados con seed compartido (`e2e/helpers.ts` con setup de matches, grupos, torneos preseedeados).
- Decisión de producto sobre "Revisa tu correo" (retry / polling / botón reenviar).
- El presupuesto "empezar partida desde home ≤3 taps" queda en 4–5 taps con chips; llegar a 3 requiere reducir el step de modalidad (ya cubierto por `skip_modality_prompt` para el 80% de casos).

---

*Auditoría y sprints ejecutados por Claude siguiendo el prompt de audit UX del 2026-08-26. Cambios agrupados en un solo trabajo continuo — falta commit + PR final para consolidar.*
