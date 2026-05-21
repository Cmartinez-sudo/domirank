# DomiRank — User Stories v5

**Epic Q — Attestation: el core de confianza de DomiRank**

Cambio fundamental del modelo: cualquier jugador puede crear partidas con cualquier otro jugador (no requiere amistad previa), pero **toda partida necesita consenso de al menos 3 de los 4 jugadores antes de afectar el rating**.

Este epic **supersede USER_STORIES_v3.md → Epic O.3** (matches solo entre amigos). Mantiene Epic O.1 (FriendActionButton) y O.2 (notificaciones in-app).

Stack: Next.js 14 App Router + TypeScript + Tailwind + Supabase.

---

## Decisiones de producto (no las re-cuestiones, ejecútalas)

| Decisión | Valor |
|----------|-------|
| Qué cuenta como attestation | Scorekeeper firma automáticamente al registrar el score (= 1 confirmación). Necesita 2 confirmaciones explícitas adicionales de los otros 3 jugadores para llegar a quórum de 3. |
| Disputas | Una disputa NO congela si ya hay 3 confirmaciones (gana consenso). Solo 2 o más disputas mueven el match a `disputed`. |
| Expiración | A los 7 días sin disputas, el match se auto-confirma con las firmas que tenga. Silence = consent. |
| Invitación | Los jugadores se agregan directo a la partida buscando por username. Reciben notificación pero no requieren aceptación previa para jugar. Confirman/disputan al final. |
| Rating | Solo se aplica al pasar a `confirmed`. Las partidas `pending_attestation` o `disputed` NO afectan rating, NO cuentan en stats. |
| Visibilidad en perfil | Partidas `pending_attestation` aparecen marcadas como "pendiente" en el historial del propio jugador, ocultas para terceros. Solo `confirmed` aparece en stats públicos. |

---

## Q1 — Eliminar restricción de amigos al crear partida + búsqueda global de jugadores

### Historia
> **Como** jugador
> **quiero** poder agregar a cualquier usuario de DomiRank a una partida (no solo a mis amigos)
> **para** registrar partidas presenciales contra rivales que acabo de conocer y crecer mi red orgánicamente.

### Cambios

**1. Remover el filtro de amigos** en `searchFriends` server action y reemplazarlo por `searchPlayers`:

```ts
// src/lib/players-actions.ts
"use server";
import { supabaseServer } from "@/lib/supabase/server";

export async function searchPlayers(query: string) {
  if (query.length < 2) return { ok: true as const, players: [] };
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "No autenticado" };

  // Búsqueda case-insensitive en username o display_name, excluyendo al usuario actual.
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, country")
    .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
    .neq("id", user.id)
    .limit(10);

  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, players: data ?? [] };
}
```

**2. Modificar `NewMatchForm`** para usar el nuevo search:

- Reemplaza el dropdown de "amigos" por un autocomplete de tipo combobox.
- Muestra avatar + display_name + @username + país.
- Indicador sutil si el jugador es amigo (`<FriendBadge>`).
- No bloquea selección de no-amigos.
- Mantiene tope de 4 jugadores (3 + el creador).

**3. Empty state** del formulario:
- Si no hay query: muestra los 5 amigos más recientes como atajo.
- Si hay query sin resultados: "No encontramos a nadie. ¿Lo escribiste bien?".

### Acceptance criteria
- [ ] Buscar "ka" muestra a "Kako" aunque no sea amigo del usuario actual.
- [ ] Puedes crear una partida con 3 no-amigos.
- [ ] El propio usuario nunca aparece en resultados.
- [ ] Los amigos aparecen primero cuando hay match parcial (ordenamiento: amigos primero, después por wins desc o created_at desc).
- [ ] Server action protegida por rate limit (`checkLimit(rl.search, ...)`).

---

## Q2 — Modelo de datos y state machine de attestation

### Historia
> **Como** sistema
> **necesito** registrar quién firma o disputa cada partida y aplicar reglas de quórum atómicamente
> **para** garantizar que solo partidas con consenso afecten el rating y que el flujo sea robusto ante concurrencia.

### State machine

```
┌──────────────┐  finalize()           ┌──────────────────────┐
│ in_progress  │ ────────────────────► │ pending_attestation  │
└──────────────┘  (scorekeeper auto-   └──────────┬───────────┘
                   confirma)                      │
                                                  │
                          ┌───────────────────────┼───────────────────────┐
                          │                       │                       │
                  confirms ≥ 3                disputes ≥ 2          7 días sin disputas
                  & disputes < 2              independiente              ↓
                          ↓                       │                  ┌──────────┐
                  ┌──────────────┐                │                  │confirmed │
                  │  confirmed   │ ◄──────────────┼──────────────────┘   apply
                  └──────┬───────┘                │                       rating
                         │                        ↓
                  apply rating              ┌──────────────┐
                  + write to                │  disputed    │
                  rating_history            └──────┬───────┘
                                                   │
                                            admin resolve
                                                   ↓
                                            confirmed | void
```

### Migración

```sql
-- supabase/migrations/0012_attestation.sql

-- ============================================================
-- 1) Estado expandido de matches
-- ============================================================
do $$
begin
  -- si matches.status era text simple, lo dejamos como text pero documentamos los valores válidos
  if not exists (
    select 1 from pg_constraint where conname = 'matches_status_check'
  ) then
    alter table public.matches
      add constraint matches_status_check
      check (status in ('in_progress', 'pending_attestation', 'confirmed', 'disputed', 'void', 'finished'));
    -- 'finished' se mantiene por compatibilidad con datos pre-migration; ver paso 5
  end if;
end$$;

-- Campos nuevos
alter table public.matches
  add column if not exists scorekeeper_id uuid references auth.users(id),
  add column if not exists finalized_at timestamptz,
  add column if not exists confirmed_at timestamptz,
  add column if not exists rated_at timestamptz;     -- cuando se aplicó al rating

create index if not exists idx_matches_status_finalized
  on public.matches (status, finalized_at)
  where status = 'pending_attestation';

-- ============================================================
-- 2) Tabla de attestations
-- ============================================================
create table if not exists public.match_attestations (
  match_id    uuid not null references public.matches(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  action      text not null check (action in ('confirm','dispute')),
  comment     text,                                    -- opcional, para disputas
  created_at  timestamptz not null default now(),
  primary key (match_id, user_id)
);

create index if not exists idx_match_attest_user
  on public.match_attestations (user_id, created_at desc);

alter table public.match_attestations enable row level security;

-- Cualquier participante de la partida puede leer attestations
create policy "match_attest_read_participants"
  on public.match_attestations for select
  to authenticated
  using (
    exists (
      select 1 from public.match_players mp
      where mp.match_id = match_attestations.match_id
        and mp.user_id = auth.uid()
    )
  );

-- Un usuario solo puede insertar SU propia attestation
-- y solo si la partida está en pending_attestation
create policy "match_attest_insert_own"
  on public.match_attestations for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.matches m
      join public.match_players mp on mp.match_id = m.id
      where m.id = match_attestations.match_id
        and mp.user_id = auth.uid()
        and m.status = 'pending_attestation'
    )
  );

-- Update: solo para cambiar de confirm a dispute o viceversa (idempotente vía upsert)
create policy "match_attest_update_own"
  on public.match_attestations for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- No DELETE — cambias tu attestation con update, no la borras.

-- ============================================================
-- 3) Función de quórum: idempotente, llamada después de cada attestation
-- ============================================================
create or replace function public.evaluate_match_quorum(p_match_id uuid)
returns text                                            -- nuevo estado: 'pending_attestation' | 'confirmed' | 'disputed'
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_confirms int;
  v_disputes int;
  v_total_players int;
  v_new_status text;
begin
  -- Solo evaluamos si está en pending_attestation
  select status into v_status from matches where id = p_match_id for update;
  if v_status <> 'pending_attestation' then
    return v_status;
  end if;

  select count(*) into v_total_players
  from match_players where match_id = p_match_id;

  select
    count(*) filter (where action = 'confirm'),
    count(*) filter (where action = 'dispute')
  into v_confirms, v_disputes
  from match_attestations
  where match_id = p_match_id;

  -- Regla: 2+ disputas → disputed, AUNQUE haya 3 confirms (no, espera: el usuario decidió que con 3 confirms gana consenso incluso si hay 1 disputa).
  -- Re-leyendo: "Si hay 3 confirmaciones, gana el consenso aunque haya 1 disputa. Solo si hay 2+ disputas se congela."
  -- Por tanto la condición de disputed es: disputes >= 2 (y confirms no compensa eso).

  if v_disputes >= 2 then
    v_new_status := 'disputed';
  elsif v_confirms >= 3 then
    v_new_status := 'confirmed';
  else
    v_new_status := 'pending_attestation';
  end if;

  if v_new_status <> v_status then
    update matches
      set status = v_new_status,
          confirmed_at = case when v_new_status = 'confirmed' then now() else confirmed_at end
      where id = p_match_id;

    -- Si pasó a confirmed, aplicar rating (function externa, ver Q6)
    if v_new_status = 'confirmed' then
      perform public.apply_match_rating(p_match_id);
    end if;
  end if;

  return v_new_status;
end;
$$;

grant execute on function public.evaluate_match_quorum(uuid) to authenticated;

-- ============================================================
-- 4) Server action helper: attest_match
-- ============================================================
create or replace function public.attest_match(
  p_match_id uuid,
  p_action text,
  p_comment text default null
)
returns text                                              -- nuevo status del match
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_new_status text;
begin
  if v_user is null then
    raise exception 'auth_required';
  end if;
  if p_action not in ('confirm','dispute') then
    raise exception 'invalid_action';
  end if;

  -- Verifica que el usuario es participante
  if not exists (
    select 1 from match_players where match_id = p_match_id and user_id = v_user
  ) then
    raise exception 'not_a_participant';
  end if;

  -- Upsert: si ya había attestado, sobrescribe (puede pasar de confirm a dispute)
  insert into match_attestations (match_id, user_id, action, comment)
  values (p_match_id, v_user, p_action, p_comment)
  on conflict (match_id, user_id)
  do update set action = excluded.action, comment = excluded.comment, created_at = now();

  v_new_status := public.evaluate_match_quorum(p_match_id);
  return v_new_status;
end;
$$;

grant execute on function public.attest_match(uuid, text, text) to authenticated;

-- ============================================================
-- 5) Migración de datos existentes: cualquier match 'finished' previo a esta migración
-- se da por confirmed con consenso tácito (legacy).
-- ============================================================
update public.matches
  set status = 'confirmed',
      confirmed_at = coalesce(confirmed_at, finished_at, now()),
      rated_at = coalesce(rated_at, finished_at, now())
where status = 'finished';
```

### Server action wrapper (TypeScript)

```ts
// src/lib/match-attest-actions.ts
"use server";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { checkLimit, rl } from "@/lib/rate-limit";

export async function attestMatch(matchId: string, action: "confirm" | "dispute", comment?: string) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "No autenticado" };

  const limited = await checkLimit(rl.attest, user.id);
  if (!limited.ok) return { ok: false as const, error: "Demasiados intentos" };

  const { data, error } = await supabase.rpc("attest_match", {
    p_match_id: matchId,
    p_action: action,
    p_comment: comment ?? null,
  });

  if (error) return { ok: false as const, error: error.message };

  revalidatePath(`/matches/${matchId}`);
  revalidatePath("/dashboard");
  return { ok: true as const, newStatus: data as string };
}
```

### Acceptance criteria
- [ ] La migración corre limpia tanto en DB vacía como en DB con datos.
- [ ] `attest_match` falla si el usuario no es participante.
- [ ] `attest_match` permite cambiar de confirm a dispute (y viceversa) en cualquier momento mientras esté en `pending_attestation`.
- [ ] `evaluate_match_quorum` es idempotente: llamarla 5 veces seguidas no rompe nada.
- [ ] Test unitario: simula 3 confirms → status pasa a confirmed.
- [ ] Test unitario: simula 2 disputes + 2 confirms → status pasa a disputed.
- [ ] Test unitario: simula 3 confirms + 1 dispute → status pasa a confirmed (consenso gana).

---

## Q3 — UI: pantalla de attestation y match detail con badges

### Historia
> **Como** jugador de una partida recién terminada
> **quiero** ver claramente quién confirmó y quién no, y poder firmar o disputar fácilmente
> **para** que la partida cuente para el rating cuanto antes (o para señalar un problema si los puntos no son correctos).

### Diseño

**A. Banner en match detail** `/matches/[id]`:

```
┌─ Estado de la partida ──────────────────────────────────┐
│                                                         │
│  🟡 Pendiente de confirmación                           │
│                                                         │
│  Para que afecte el rating, se necesitan al menos       │
│  3 de los 4 jugadores firmando el resultado.            │
│                                                         │
│  Faltan 1 firma · Se auto-confirma en 5 días si nadie  │
│  reporta problema.                                      │
│                                                         │
│  ┌─────────────────────────────────────────┐           │
│  │ ✅ Carlos      firmó · scorekeeper       │           │
│  │ ✅ Erik        firmó hace 2h             │           │
│  │ ⏳ Gibbon      pendiente                 │           │
│  │ ⚠️ Gusi        reportó problema          │           │
│  └─────────────────────────────────────────┘           │
│                                                         │
│  [Confirmar resultado]  [Reportar problema]             │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**B. Cuando ya está `confirmed`:**

```
┌─ Resultado confirmado ──────────────────────────────────┐
│  ✅ Confirmado · hace 3h                                │
│  Aplicado a tu rating: +0.4                             │
└─────────────────────────────────────────────────────────┘
```

**C. Cuando está `disputed`:**

```
┌─ Partida en disputa ────────────────────────────────────┐
│  ⚠️ Hay 2 o más reportes sobre esta partida. No afecta  │
│  el rating hasta que se resuelva. Si fuiste tú quien    │
│  registró el score, puedes editar y reenviar.           │
│                                                         │
│  Reportes:                                              │
│  • Gusi: "El score del último round es 92, no 100"      │
│  • Erik: "Olvidamos contar la capicúa"                  │
│                                                         │
│  [Editar score]  (solo scorekeeper)                     │
└─────────────────────────────────────────────────────────┘
```

**D. Dialog de "Reportar problema":**

```
┌──────────────────────────────────────────┐
│  Reportar problema                       │
│                                          │
│  ¿Qué no cuadra? (opcional)              │
│  ┌────────────────────────────────────┐  │
│  │ Ej: el score final es incorrecto…  │  │
│  └────────────────────────────────────┘  │
│                                          │
│  Al reportar, esta partida se marcará    │
│  como en disputa y no afectará al        │
│  rating hasta resolverse.                │
│                                          │
│  [Cancelar]  [Reportar]                  │
└──────────────────────────────────────────┘
```

### Implementación

**Componente principal:** `src/components/match/AttestationPanel.tsx` (Client)

```tsx
"use client";
import { useState, useTransition } from "react";
import { attestMatch } from "@/lib/match-attest-actions";

type Attestation = {
  user_id: string;
  action: "confirm" | "dispute";
  comment: string | null;
  created_at: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

type Props = {
  matchId: string;
  status: "pending_attestation" | "confirmed" | "disputed" | "void";
  scorekeeperId: string;
  viewerId: string;
  players: { user_id: string; username: string; display_name: string | null; avatar_url: string | null }[];
  attestations: Attestation[];
  finalizedAt: string;
  ratingDelta?: number;            // si está confirmed, cuánto cambió el rating del viewer
};

export function AttestationPanel(props: Props) {
  const myAttestation = props.attestations.find((a) => a.user_id === props.viewerId);
  const isScorekeeper = props.viewerId === props.scorekeeperId;
  const confirms = props.attestations.filter((a) => a.action === "confirm").length;
  const disputes = props.attestations.filter((a) => a.action === "dispute").length;
  const remainingDays = daysUntilAutoConfirm(props.finalizedAt);

  // ... renderiza según status
}

function daysUntilAutoConfirm(finalizedAtIso: string) {
  const finalized = new Date(finalizedAtIso).getTime();
  const expires = finalized + 7 * 24 * 60 * 60 * 1000;
  return Math.max(0, Math.ceil((expires - Date.now()) / (24 * 60 * 60 * 1000)));
}
```

**Sub-componentes:**
- `AttestationRow`: una fila por jugador con avatar, status icon, etiqueta "scorekeeper" si aplica.
- `ReportDialog`: modal con textarea opcional y botones.

**Lógica del botón:**
- Si ya firmó como `confirm` → mostrar "Cambiar a reportar" (link sutil).
- Si ya firmó como `dispute` → mostrar "Cambiar a confirmar".
- Si nunca firmó → muestra ambos botones lado a lado.

**Page integration:** `src/app/matches/[id]/page.tsx` (Server) carga `matches`, `match_players`, `match_attestations` y pasa todo a `<AttestationPanel>`. Si es `confirmed`, calcula `ratingDelta` del viewer leyendo `rating_history`.

### Reglas
- El panel solo se muestra si el viewer es participante de la partida.
- Para no-participantes el detalle de match muestra solo el resultado final y "Estado: pendiente" sin los nombres de quién firmó.
- Toasts: "Resultado confirmado", "Partida reportada — esperando otros jugadores".
- Animar transiciones de status con `framer-motion`.

### Acceptance criteria
- [ ] El scorekeeper aparece marcado como "✅ firmó · scorekeeper" automáticamente.
- [ ] Puedo confirmar y luego cambiar a dispute (o viceversa) sin recargar.
- [ ] El contador "Faltan X firmas" se actualiza en tiempo real (via Realtime subscribe, ver Q4).
- [ ] El banner cambia visualmente cuando la partida pasa a `confirmed` (sin recargar).
- [ ] Para no-participantes, el panel no se renderiza.
- [ ] Mobile: botones grandes (min 44px tap target).

---

## Q4 — Notificaciones in-app: attest pendiente, attest resuelto, disputa

### Historia
> **Como** participante de una partida que terminó hace 1h
> **quiero** recibir una notificación pidiéndome confirmar el resultado
> **para** no olvidar firmar y que la partida pueda contar para el rating.

### Eventos a notificar

| Evento | A quién | Tipo |
|--------|---------|------|
| Match pasa a `pending_attestation` | A los 3 jugadores no-scorekeeper | `attest_requested` |
| Cualquier jugador hace `attest_match` | A los otros 3 jugadores | `attest_action` |
| Match pasa a `confirmed` | A los 4 jugadores | `match_confirmed` |
| Match pasa a `disputed` | A los 4 jugadores | `match_disputed` |
| Auto-confirm via cron | A los 4 jugadores | `match_auto_confirmed` |

### Implementación

**Reusa la tabla `notifications` ya creada en Epic O.2.**
Agrega los tipos nuevos al CHECK del enum si lo definiste:

```sql
-- en la migración 0012 (al final)
do $$
begin
  if exists (select 1 from pg_constraint where conname = 'notifications_type_check') then
    alter table public.notifications drop constraint notifications_type_check;
  end if;
  alter table public.notifications
    add constraint notifications_type_check
    check (type in (
      'friend_request_received', 'friend_request_accepted',
      'attest_requested', 'attest_action', 'match_confirmed', 'match_disputed', 'match_auto_confirmed'
    ));
end$$;
```

**Trigger al finalizar partida:** cuando `matches.status` pasa a `pending_attestation`, crear notificación para cada jugador no-scorekeeper.

```sql
create or replace function public.notify_attest_requested()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'pending_attestation' and (old.status is null or old.status <> 'pending_attestation') then
    insert into public.notifications (user_id, type, ref_match_id, payload)
    select mp.user_id, 'attest_requested', new.id,
           jsonb_build_object('scorekeeper_id', new.scorekeeper_id)
    from public.match_players mp
    where mp.match_id = new.id
      and mp.user_id <> new.scorekeeper_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_attest_requested on public.matches;
create trigger trg_notify_attest_requested
  after update of status on public.matches
  for each row
  execute function public.notify_attest_requested();
```

**Trigger al cambio de estado a confirmed/disputed:**

```sql
create or replace function public.notify_match_resolved()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status = 'pending_attestation' and new.status in ('confirmed', 'disputed') then
    insert into public.notifications (user_id, type, ref_match_id, payload)
    select mp.user_id,
           case
             when new.status = 'confirmed' and new.confirmed_at is not null and (now() - new.finalized_at) > interval '6 days'
                  then 'match_auto_confirmed'
             when new.status = 'confirmed' then 'match_confirmed'
             else 'match_disputed'
           end,
           new.id,
           '{}'::jsonb
    from public.match_players mp
    where mp.match_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_match_resolved on public.matches;
create trigger trg_notify_match_resolved
  after update of status on public.matches
  for each row
  execute function public.notify_match_resolved();
```

**Trigger en `match_attestations`** para notificar a los otros 3 cuando alguien firma:

```sql
create or replace function public.notify_attest_action()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, type, ref_match_id, payload)
  select mp.user_id, 'attest_action', new.match_id,
         jsonb_build_object('actor_id', new.user_id, 'action', new.action)
  from public.match_players mp
  where mp.match_id = new.match_id
    and mp.user_id <> new.user_id;
  return new;
end;
$$;

drop trigger if exists trg_notify_attest_action on public.match_attestations;
create trigger trg_notify_attest_action
  after insert or update on public.match_attestations
  for each row
  execute function public.notify_attest_action();
```

### UI: dashboard widget "Partidas pendientes de tu firma"

```
┌─ Pendientes de tu firma (2) ────────────────────────────┐
│                                                         │
│  🎲 Venezolano · 22 may                                 │
│     Carlos & Tú 100 — 87 Erik & Gibbon                  │
│     [Confirmar]  [Reportar]                             │
│                                                         │
│  🎲 Dominicano · 21 may                                 │
│     Tú & Pedro 88 — 100 Kako & Gusi                     │
│     [Confirmar]  [Reportar]                             │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

Componente: `src/components/dashboard/PendingAttestationsCard.tsx`.
Server-side query: matches donde el viewer es jugador, status = `pending_attestation`, y NO ha firmado todavía.

### Acceptance criteria
- [ ] Al finalizar una partida, los 3 jugadores no-scorekeeper reciben notificación `attest_requested`.
- [ ] El badge del bell icon (Epic O.2) incrementa.
- [ ] Click en notificación lleva directo a `/matches/[id]` con scroll al `<AttestationPanel>`.
- [ ] Dashboard muestra widget "Pendientes de tu firma" cuando hay ≥1.
- [ ] El widget no aparece si no hay pendientes (no muestra "0 pendientes").
- [ ] Tap "Confirmar" desde el widget firma sin abrir el match detail.

---

## Q5 — Auto-confirm job (7 días) + admin dispute resolution

### Historia
> **Como** sistema
> **necesito** auto-confirmar partidas pendientes después de 7 días sin disputas
> **para** que el rating refleje toda la actividad real y no queden partidas zombi.

> **Como** admin (Carlos por ahora)
> **quiero** ver y resolver las partidas en disputa
> **para** mantener la integridad del rating cuando haya conflicto real.

### Auto-confirm

**Edge Function en Supabase** (recomendado para no depender de Vercel cron):

```ts
// supabase/functions/auto-confirm-stale-matches/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data, error } = await supabase.rpc("auto_confirm_stale_matches");
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify({ confirmed: data }), { status: 200 });
});
```

**RPC en Postgres:**

```sql
create or replace function public.auto_confirm_stale_matches()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int := 0;
  m record;
begin
  for m in
    select id from matches
    where status = 'pending_attestation'
      and finalized_at < now() - interval '7 days'
      and not exists (
        select 1 from match_attestations a
        where a.match_id = matches.id and a.action = 'dispute'
      )
  loop
    update matches
      set status = 'confirmed',
          confirmed_at = now()
      where id = m.id;
    perform public.apply_match_rating(m.id);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

grant execute on function public.auto_confirm_stale_matches() to service_role;
```

**Schedule:** corre la edge function 1 vez al día a las 03:00 UTC vía `pg_cron` o el scheduler de Supabase.

```sql
-- Si tienes pg_cron habilitado en el proyecto Supabase
select cron.schedule(
  'auto-confirm-stale-matches',
  '0 3 * * *',
  $$ select public.auto_confirm_stale_matches(); $$
);
```

### Admin dispute resolution

**Página:** `/admin/disputes` (gateada por `profile.role = 'admin'`).

```
┌─ Partidas en disputa (3) ───────────────────────────────┐
│                                                         │
│  Match #abc123 · Venezolano · 22 may                    │
│  Carlos & Tú 100 — 87 Erik & Gibbon                     │
│                                                         │
│  Confirmaciones (2):                                    │
│   • Carlos (scorekeeper)                                │
│   • Erik · hace 3h                                      │
│                                                         │
│  Reportes (2):                                          │
│   • Gibbon: "El score real es 88, no 87"                │
│   • Gusi: "Olvidaron contar capicúa"                    │
│                                                         │
│  [Marcar como void]  [Confirmar tal como está]          │
│  [Editar score y reconfirmar]                           │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Server actions:**
- `adminResolveMatch(matchId, "confirm" | "void", newScore?)`: solo callable si `auth.uid()` tiene `profiles.role = 'admin'`.
- Si confirma: pasa a `confirmed`, aplica rating.
- Si void: pasa a `void`, NO afecta rating, sale del historial visible.

**Migración adicional** (en 0012):

```sql
alter table public.profiles
  add column if not exists role text not null default 'user'
  check (role in ('user', 'admin'));

-- Carlos como admin
update public.profiles
  set role = 'admin'
  where username = 'kako';   -- ajusta al username real de Carlos
```

### Acceptance criteria
- [ ] La edge function `auto-confirm-stale-matches` puede ejecutarse manualmente y retorna número de partidas confirmadas.
- [ ] Una partida `pending_attestation` con 1 confirm (scorekeeper) y 0 disputas, 7 días vieja, se auto-confirma.
- [ ] Una partida `pending_attestation` con 2 disputas NO se auto-confirma (queda `disputed`).
- [ ] El cron diario corre y deja log de cuántas confirmó.
- [ ] `/admin/disputes` es 404 para usuarios no-admin.
- [ ] Admin puede resolver una disputa marcándola void o confirmándola.

---

## Q6 — Gating del rating: solo partidas `confirmed` afectan al DomiRank

### Historia
> **Como** jugador
> **quiero** que mi rating refleje SOLO partidas con consenso de los participantes
> **para** que no se manipule por scores falsos o partidas no validadas.

### Cambios clave

**1. Mover la lógica de aplicar rating** de "al finalizar partida" a "al confirmar partida":

```sql
-- ya referenciada en Q2, definirla acá si no existe:
create or replace function public.apply_match_rating(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m record;
begin
  select * into m from matches where id = p_match_id;
  if m is null then return; end if;
  if m.rated_at is not null then return; end if;     -- idempotente
  if m.status <> 'confirmed' then return; end if;

  -- Aquí lo que ya hacías en finalizeMatch:
  -- 1) calcular nuevas mu/sigma por jugador via OpenSkill (en TS, no en SQL — ver siguiente paso)
  -- 2) escribir en rating_history
  -- 3) marcar rated_at

  -- Como OpenSkill corre en TS, esta función SQL solo marca el flag y dispara una notificación
  -- que el server side puede capturar. Alternativa más simple: el cron + el RPC apply_match_rating
  -- llaman a una edge function que sí ejecuta TS.

  update matches set rated_at = now() where id = p_match_id;
end;
$$;
```

**2. Reorganizar `finalizeMatch`** (TypeScript, server action que cierra el live match):

```ts
// src/lib/match-actions.ts (modificación)
export async function finalizeMatch(matchId: string, scores: { team1: number; team2: number; rounds: any[] }) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "No autenticado" };

  // 1. Actualiza scores y mueve a pending_attestation (NO aplica rating todavía)
  const { error: e1 } = await supabase
    .from("matches")
    .update({
      status: "pending_attestation",
      finalized_at: new Date().toISOString(),
      scorekeeper_id: user.id,
      score_team1: scores.team1,
      score_team2: scores.team2,
      winner_team: scores.team1 > scores.team2 ? 1 : 2,
    })
    .eq("id", matchId)
    .eq("status", "in_progress");      // optimistic concurrency
  if (e1) return { ok: false as const, error: e1.message };

  // 2. Auto-attest del scorekeeper como confirm
  await supabase.rpc("attest_match", {
    p_match_id: matchId,
    p_action: "confirm",
    p_comment: null,
  });

  revalidatePath(`/matches/${matchId}`);
  revalidatePath("/dashboard");
  return { ok: true as const };
}
```

**3. Hook al confirmar partida** (cuando `evaluate_match_quorum` la marca confirmed):

La función SQL `apply_match_rating` solo marca el flag, pero el cálculo real de OpenSkill ocurre en TypeScript. Estrategia:

- `apply_match_rating` envía un payload a una edge function (`/functions/v1/rate-match`) usando `pg_net` o un trigger en `matches.rated_at IS NULL AND status='confirmed'`.
- La edge function lee la partida + jugadores, llama a OpenSkill, escribe en `rating_history` y actualiza el `mu`/`sigma` de los jugadores en la tabla `player_ratings`.

**Implementación recomendada:** Postgres webhook (Supabase Database Webhooks) configurado para disparar la edge function al UPDATE `matches` con `status = 'confirmed' AND rated_at IS NULL`.

**4. Filtrar todo el historial y stats para considerar solo `confirmed`:**

- `profile_ratings` (vista): WHERE `m.status = 'confirmed'`.
- `head_to_head_matches` RPC (de v4): WHERE `m.status = 'confirmed'`.
- `tournament_standings` RPC (de v4): WHERE `m.status = 'confirmed'`.
- `profile_stats` RPC: WHERE `m.status = 'confirmed'`.
- Leaderboard global: WHERE `m.status = 'confirmed'`.
- Historial en perfil propio: incluir también `pending_attestation` PERO marcadas con badge "Pendiente" (gris).

**5. Stat preview en `pending_attestation`:**

Muestra al usuario un "preview" del cambio de rating que tendrá si se confirma, pero no lo aplica:

```
"Si esta partida se confirma, tu DomiRank pasará de 14.2 a 14.6 (+0.4)."
```

Esto se calcula en el cliente con el motor de OpenSkill local sin tocar DB.

### Acceptance criteria
- [ ] Una partida en `pending_attestation` NO modifica el rating mostrado en el perfil.
- [ ] Stats del perfil (`profile_stats`) ignoran partidas no-confirmadas.
- [ ] Cuando una partida pasa a `confirmed`, el rating se actualiza en menos de 5 segundos (cron de webhook).
- [ ] Auto-confirm + apply rating funciona end-to-end: una partida vieja de 7 días aparece en `rating_history` después del cron.
- [ ] La doble llamada a `apply_match_rating` para la misma partida NO duplica entradas en `rating_history`.
- [ ] El historial del propio jugador muestra partidas pending con un badge "Pendiente" gris.
- [ ] El historial público (otro perfil) NO muestra partidas pending del jugador, solo confirmed.

---

# Prompt para Claude Code

```
Eres senior fullstack engineer trabajando en DomiRank (Next.js 14 App Router,
TypeScript, Tailwind, Supabase Postgres + Edge Functions). Lee
USER_STORIES_v5.md y ejecuta el Epic Q COMPLETO en este orden estricto:

  Q1 — Eliminar friend-gating + búsqueda global searchPlayers
  Q2 — Migración 0012 con state machine de attestation + RPCs
  Q3 — Componente AttestationPanel + match detail UI
  Q4 — Notificaciones in-app para todos los eventos del attest flow
  Q5 — Edge function auto-confirm + admin disputes
  Q6 — Gating del rating: solo confirmed afecta

═══════════════════════════════════════════════════════════════════════════
CAMBIO FUNDAMENTAL — ANTES DE EMPEZAR
═══════════════════════════════════════════════════════════════════════════

Este epic supersede USER_STORIES_v3.md → Epic O.3 (matches solo entre amigos).
Si ya implementaste el friend-gating, DEBES revertirlo. La nueva regla es:

  • Cualquier jugador puede jugar con cualquier otro.
  • La confianza viene de los attestations: 3 de 4 jugadores deben firmar.
  • El scorekeeper firma automáticamente al cerrar la partida (= 1 firma).
  • 2 disputas → match en disputed.
  • 3 confirms con ≤1 disputa → match confirmed.
  • 7 días sin disputas → auto-confirm con las firmas que haya.
  • Solo partidas confirmed afectan rating, stats, leaderboard, gráficos.

═══════════════════════════════════════════════════════════════════════════
REQUISITOS NO NEGOCIABLES
═══════════════════════════════════════════════════════════════════════════

1. UNA SOLA MIGRACIÓN: supabase/migrations/0012_attestation.sql con TODO
   (state machine, tablas, RPCs, triggers, ajustes a notifications). Debe ser
   idempotente: re-ejecutable sin errores.

2. RLS estricto en match_attestations: SELECT solo para participantes,
   INSERT/UPDATE solo del propio user_id Y solo si la partida está en
   pending_attestation.

3. Trigger de notificaciones para CADA cambio de estado y para cada
   attestation nueva. Reusa la tabla notifications de Epic O.2.

4. Reorganiza finalizeMatch en src/lib/match-actions.ts (o donde esté) para
   que mueva a pending_attestation en vez de aplicar rating directamente.
   El rating se aplica vía Database Webhook que llama a la edge function
   rate-match cuando matches.status pasa a confirmed.

5. Crea la edge function supabase/functions/auto-confirm-stale-matches/
   con su index.ts. Documenta en el README de la edge function cómo
   configurar el cron (pg_cron o Supabase scheduler).

6. Crea también supabase/functions/rate-match/ que reciba { match_id } y
   ejecute el cálculo OpenSkill usando el código existente de
   src/lib/rating.ts. Si rating.ts no es importable desde Deno, replica la
   lógica con la misma versión de openskill desde esm.sh.

7. Migra datos legacy: cualquier match con status = 'finished' se convierte
   en status = 'confirmed' con confirmed_at = finished_at en la migración.

8. Reemplaza COMPLETAMENTE searchFriends por searchPlayers en NewMatchForm.
   No quites a los amigos del resultado: muéstralos primero (ordenamiento:
   friends_first DESC, then created_at DESC).

9. Filtra TODAS estas queries para incluir solo matches confirmed:
     - profile_ratings (vista)
     - profile_stats RPC
     - head_to_head_matches RPC
     - tournament_standings RPC
     - cualquier leaderboard agregado
     - historial PÚBLICO (de otros jugadores)
   EXCEPCIÓN: el historial del propio jugador SÍ incluye pending_attestation
   pero las marca con un badge "Pendiente" en UI.

10. UI mobile-first. Botones de tap mínimo 44px. Estados de loading con
    skeleton, no spinners. Transiciones con framer-motion (subtle).

11. NO crees archivos markdown nuevos. Solo código.

12. Tipos estrictos: nada de any. Define tipos en src/types/attestation.ts.

13. Después de cada story corre `npm run build`. Si hay error TS, arréglalo.

═══════════════════════════════════════════════════════════════════════════
PRUEBAS QUE QUIERO QUE CORRAS MANUALMENTE
═══════════════════════════════════════════════════════════════════════════

Después de terminar las 6 stories, en la DB de dev:

a) Crea un match con 4 jugadores (uno seas tú, otros 3 cualquiera).
b) Termina la partida → debe quedar pending_attestation con tu firma como
   scorekeeper.
c) Loguéate como jugador 2 → ve a /matches/[id] → confirma → status sigue
   pending_attestation (2 firmas, falta 1).
d) Loguéate como jugador 3 → confirma → match pasa a confirmed → rating
   se aplica (verifica rating_history y profile_ratings).
e) Crea otro match. Termina como scorekeeper. Loguéate como jugador 2 →
   reporta problema. Loguéate como jugador 3 → reporta problema. Match
   debe pasar a disputed.
f) Para auto-confirm: en pgAdmin o SQL editor, fuerza un match a tener
   finalized_at = now() - interval '8 days', luego ejecuta
   `select public.auto_confirm_stale_matches();` manualmente → debe
   confirmar y aplicar rating.

Reporta al final:
- Lista de archivos creados/modificados.
- Cualquier paso pendiente para producción (configurar webhook de Supabase,
  habilitar pg_cron, etc.) — paso a paso, no asumas que yo sé.
- Screenshot mobile del AttestationPanel en cada uno de los 3 estados.
```

---

## Notas para Carlos (NO van al prompt)

1. **Riesgo del rating en TypeScript via webhook:** la cadena `confirm → DB webhook → edge function → OpenSkill → rating_history` tiene 4 puntos de falla. Si te complica el debugging, una alternativa más simple para arrancar es:
   - Hacer que `attestMatch` server action (TS) detecte cuando el nuevo estado es `confirmed` y aplique el rating ahí mismo, en el mismo request.
   - Solo el cron de auto-confirm necesita pasar por edge function porque corre fuera de un request de usuario.
   Dime si prefieres esa simplificación y te re-escribo Q6.

2. **Migración de matches legacy:** la migración convierte automáticamente `status = 'finished'` → `'confirmed'`. Si tienes partidas mal cargadas que NO querías que contaran para el rating, márcaalas como `void` en DB antes de correr la migración 0012.

3. **Rol admin:** te dejé el rol con `username = 'kako'`. Si tu username real es otro, ajustalo o lo cambias después con un UPDATE manual.

4. **pg_cron en Supabase:** está disponible en planes Pro+. Si estás en Free, usa el scheduler de Vercel apuntando a la edge function. Si me confirmas el plan, te ajusto las instrucciones.

5. **Casos borde no cubiertos (decidir después):**
   - ¿Un jugador puede borrar su propia attestation? Actualmente solo puede cambiarla. Sin DELETE. Mantén así por simplicidad.
   - ¿Qué pasa si el scorekeeper se reporta a sí mismo (dispute al cerrar)? El flow actual permite que el scorekeeper haga `dispute` después de su confirm inicial → cambia su attestation. Es válido y útil ("me equivoqué al meter el score").
   - ¿Qué pasa con torneos? Los matches de torneo siguen el mismo flow. El leaderboard del torneo (Q4 de v4) filtra por `confirmed` también.

6. **Comunicación con usuarios:** vas a necesitar agregar a `/como-funciona` una sección explicando este modelo de confianza. Te puedo escribir el texto cuando termines el epic.

7. **Orden de ejecución sugerido contra tus epics anteriores:**
   - Epic O (v3) → friends + notificaciones in-app **(ejecutar primero si no lo hiciste)**
   - Epic P (v4) → perfiles públicos + leaderboard de torneos
   - Epic Q (v5, este) → attestation **(este reemplaza la pieza de O.3)**
   - Después de Q, puedes pasar a v2 (rating visibility, sin banderas, etc.)

Sources:
- [USER_STORIES_v5.md](computer:///Users/carlosmartinez/Documents/Claude/Projects/Domino/USER_STORIES_v5.md)
