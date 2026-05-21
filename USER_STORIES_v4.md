# DomiRank — User Stories v4

**Epic P — Perfiles públicos, historial head-to-head, gráfico de evolución y leaderboard de torneos**

Continúa lo definido en `USER_STORIES_v3.md` (Epic O: FriendActionButton, notificaciones in-app, friends-only matches).
Stack: Next.js 14 App Router + TypeScript + Tailwind + Supabase (Postgres + Auth + Realtime) + Recharts.

Decisiones de producto ya tomadas (no las re-cuestiones, ejecútalas):

- **Privacidad:** perfiles públicos para todos los usuarios logueados. Historial y gráfico también públicos. RLS sigue protegiendo escritura.
- **Head-to-head con amigos:** mostrar TODAS las partidas donde ambos jugaron (aliados o rivales). Columna "Resultado vs ti" con W/L desde el punto de vista del visitante.
- **Gráfico de rating:** DomiRank Global (1-20). Selector de rango: 7d / 30d / 90d / Todo. Un punto por partida.
- **Estilo "Tabla · Jugadores":** aplicar solo dentro de torneos. El global leaderboard mantiene DomiRank.

---

## P1 — Página de perfil público `/u/[username]`

### Historia
> **Como** jugador de DomiRank
> **quiero** poder entrar al perfil de otro jugador desde cualquier lugar de la app (ranking, búsqueda, historial de partidas)
> **para** ver sus stats, su nivel y decidir si lo agrego como amigo o lo reto a una partida.

### Diseño / UX

```
/u/[username]
┌─────────────────────────────────────────────────────────┐
│  [Avatar 96px]   Carlos Martínez               [···]    │
│                  @kako · 🇻🇪                              │
│                  ⭐ DomiRank 14.2 · 87 partidas         │
│                                                         │
│  [Agregar amigo]  [Retar a partida]  [Mensaje]          │
└─────────────────────────────────────────────────────────┘

┌─ Stats ────────────────────┐ ┌─ Mejor modalidad ────────┐
│  Victorias    52  (60%)    │ │  🇻🇪 Venezolano d6        │
│  Derrotas     35           │ │  Rating 15.8             │
│  Racha actual  3W          │ │  41 partidas             │
│  Mejor racha   7W          │ └──────────────────────────┘
└────────────────────────────┘

┌─ Evolución del rating ──────────────────────────────────┐
│  [7d] [30d] [90d] [Todo]                                │
│                                                         │
│  [gráfico Recharts AreaChart con gradient verde]        │
└─────────────────────────────────────────────────────────┘

┌─ Historial de partidas ─────────────────────────────────┐
│  [Todas] [Conmigo: 12 partidas]   ← tabs cuando son amigos │
│                                                         │
│  ✅ 22 may · Venezolano · Vs Erik & Gibbon · 100-87     │
│  ❌ 20 may · Dominicano · Vs Gusi & Pedro · 88-100      │
│  ...                                                    │
└─────────────────────────────────────────────────────────┘
```

### Implementación

**Ruta:**
`src/app/u/[username]/page.tsx` (Server Component)

```ts
// page.tsx — pseudo
export default async function PublicProfilePage({ params }: { params: { username: string } }) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, country, bio, created_at")
    .eq("username", params.username)
    .single();

  if (!profile) notFound();

  const isSelf = profile.id === user.id;

  // Rating global + breakdown por bucket
  const { data: ratings } = await supabase
    .from("profile_ratings")
    .select("*")
    .eq("user_id", profile.id);

  // Stats agregadas
  const { data: stats } = await supabase.rpc("profile_stats", { p_user: profile.id });

  // Relación con visitante
  const relation = await getFriendRelation(user.id, profile.id);

  return (
    <PublicProfile
      viewer={user}
      profile={profile}
      ratings={ratings}
      stats={stats}
      relation={relation}
      isSelf={isSelf}
    />
  );
}
```

**Migración 0011:**

```sql
-- supabase/migrations/0011_profile_views.sql

-- RPC para stats agregadas (V, D, %, racha actual, mejor racha)
create or replace function public.profile_stats(p_user uuid)
returns table (
  wins int,
  losses int,
  win_rate numeric,
  current_streak int,         -- positivo = wins, negativo = losses
  best_streak int,
  total_matches int
)
language sql
security definer
set search_path = public
as $$
  with player_matches as (
    select
      m.id,
      m.finished_at,
      mp.team,
      m.winner_team,
      case when mp.team = m.winner_team then 1 else 0 end as won
    from match_players mp
    join matches m on m.id = mp.match_id
    where mp.user_id = p_user
      and m.status = 'finished'
    order by m.finished_at desc
  ),
  totals as (
    select
      sum(won) as wins,
      count(*) - sum(won) as losses,
      count(*) as total
    from player_matches
  ),
  streaks as (
    select
      sum(case when won = 1 then 1 else -1 end)
        over (order by finished_at desc rows between unbounded preceding and current row) as running
    from player_matches
  )
  select
    coalesce(totals.wins, 0)::int as wins,
    coalesce(totals.losses, 0)::int as losses,
    case when totals.total > 0
      then round((totals.wins::numeric / totals.total) * 100, 0)
      else 0 end as win_rate,
    -- TODO: streak puede salir de un cursor o de una CTE recursiva si esto se queda corto
    0::int as current_streak,
    0::int as best_streak,
    coalesce(totals.total, 0)::int as total_matches
  from totals;
$$;

grant execute on function public.profile_stats(uuid) to authenticated;

-- Vista pública mínima (lo que cualquiera puede consultar)
create or replace view public.profile_public as
select
  id,
  username,
  display_name,
  avatar_url,
  country,
  bio,
  created_at
from public.profiles;

grant select on public.profile_public to authenticated;
```

**Componentes nuevos:**

- `src/app/u/[username]/PublicProfile.tsx` (Client)
- `src/components/profile/StatsCard.tsx`
- `src/components/profile/BestModalityCard.tsx`
- `src/components/profile/RatingChart.tsx` ← ver P3
- `src/components/profile/MatchHistoryList.tsx` ← ver P2
- `src/components/profile/ProfileActionsBar.tsx` (Agregar amigo / Retar / Mensaje)

`ProfileActionsBar` reusa `FriendActionButton` de O1 + un botón "Retar" que abre `/matches/new?opponent={username}` con prefill.

### Reglas
- Si `isSelf`, ocultar "Agregar amigo" y "Retar".
- Si el username no existe → 404 nativo con `notFound()`.
- El campo `bio` es opcional (max 240 chars), se agrega en `/settings`.
- Avatar fallback: iniciales sobre gradiente verde (ya existe `<Avatar>` component).
- Toda la página es SSR para SEO interno y carga inmediata.

### Acceptance criteria
- [ ] Entrar a `/u/kako` muestra perfil completo de Carlos.
- [ ] `/u/no_existe` → página 404.
- [ ] El propio usuario en su perfil ve "Editar perfil" en vez de "Agregar amigo".
- [ ] Los stats reflejan correctamente partidas terminadas (no abandonadas).
- [ ] Click en avatar de jugador desde leaderboard/matches navega aquí.

---

## P2 — Historial de partidas con tab "Conmigo" (head-to-head)

### Historia
> **Como** visitante en el perfil de otro jugador
> **quiero** ver el historial de partidas que hemos jugado juntos (aliados o rivales)
> **para** entender nuestro head-to-head y tener contexto antes de retarlo o jugar con él.

### Diseño

```
┌─ Historial de partidas ─────────────────────────────────┐
│  [Todas (87)]  [Conmigo (12)]                            │
│                                                         │
│  ── Conmigo ──                                          │
│                                                         │
│  ✅ Jugaste con él        22 may · Venezolano           │
│     Carlos & Tú 100 — 87 Erik & Gibbon                  │
│                                                         │
│  ❌ Jugaste contra él     20 may · Dominicano           │
│     Tú & Pedro 88 — 100 Carlos & Gusi                   │
│                                                         │
│  Mostrando 12 de 12                                     │
└─────────────────────────────────────────────────────────┘
```

Cuando son amigos y nunca han jugado:

```
┌─ Conmigo ───────────────────────────────────────────────┐
│                                                         │
│      🎲                                                  │
│      Aún no han jugado juntos                           │
│      Crea una partida con Carlos y empieza el head-to-head │
│      [Crear partida con Carlos]                          │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

Cuando NO son amigos:
- Tab "Conmigo" deshabilitada con tooltip "Agrégalo como amigo para ver su head-to-head contigo".

### Implementación

**RPC `head_to_head_matches`:**

```sql
-- en la misma migración 0011
create or replace function public.head_to_head_matches(
  p_viewer uuid,
  p_target uuid,
  p_limit int default 50
)
returns table (
  match_id uuid,
  finished_at timestamptz,
  modality text,
  set_size int,
  viewer_team int,
  target_team int,
  viewer_won boolean,
  same_team boolean,
  score_team1 int,
  score_team2 int,
  -- nombres de jugadores serializados como jsonb para una sola query
  players jsonb
)
language sql
security definer
set search_path = public
as $$
  with shared as (
    select m.id, m.finished_at, m.modality, m.set_size,
           m.winner_team, m.score_team1, m.score_team2,
           mp_v.team as viewer_team,
           mp_t.team as target_team
    from matches m
    join match_players mp_v on mp_v.match_id = m.id and mp_v.user_id = p_viewer
    join match_players mp_t on mp_t.match_id = m.id and mp_t.user_id = p_target
    where m.status = 'finished'
    order by m.finished_at desc
    limit p_limit
  )
  select
    s.id,
    s.finished_at,
    s.modality,
    s.set_size,
    s.viewer_team,
    s.target_team,
    (s.viewer_team = s.winner_team) as viewer_won,
    (s.viewer_team = s.target_team) as same_team,
    s.score_team1,
    s.score_team2,
    (
      select jsonb_agg(
        jsonb_build_object(
          'user_id', mp.user_id,
          'team', mp.team,
          'username', p.username,
          'display_name', p.display_name,
          'avatar_url', p.avatar_url
        ) order by mp.team, mp.position
      )
      from match_players mp
      join profiles p on p.id = mp.user_id
      where mp.match_id = s.id
    ) as players
  from shared s;
$$;

grant execute on function public.head_to_head_matches(uuid, uuid, int) to authenticated;
```

**Component:**

```tsx
// src/components/profile/MatchHistoryList.tsx
"use client";
type Tab = "all" | "with_viewer";

export function MatchHistoryList({
  viewerId,
  targetId,
  areFriends,
  isSelf,
}: { viewerId: string; targetId: string; areFriends: boolean; isSelf: boolean }) {
  const [tab, setTab] = useState<Tab>("all");
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [count, setCount] = useState({ all: 0, with_viewer: 0 });
  const [loading, setLoading] = useState(true);
  // ...fetch según tab, con cache local básico
}
```

Renderiza cada partida con:
- Ícono ✅/❌ del lado del visitante.
- Etiqueta "Jugaste con él" (same_team) o "Jugaste contra él".
- Marcador con tu team primero siempre.
- Modalidad y fecha relativa ("hace 3 d") via `date-fns`.
- Click → `/matches/{id}` (vista de partida).

### Acceptance criteria
- [ ] Tab "Todas" muestra las últimas N partidas del jugador (paginar 20).
- [ ] Tab "Conmigo" solo se habilita si son amigos (o `isSelf`).
- [ ] Si son amigos sin partidas en común, empty state con CTA "Crear partida con {nombre}".
- [ ] `viewer_won` y `same_team` marcan correctamente íconos y labels.
- [ ] El marcador del visitante siempre aparece a la izquierda independientemente del team interno.
- [ ] Tap en una partida abre su detalle.

---

## P3 — Gráfico de evolución del DomiRank Global

### Historia
> **Como** visitante en el perfil de un jugador
> **quiero** ver cómo ha evolucionado su DomiRank Global en el tiempo
> **para** entender si está en forma, si viene subiendo o bajando, y comparar visualmente niveles.

### Diseño

```
┌─ Evolución del rating ──────────────────────────────────┐
│   DomiRank Global                                       │
│   [7d] [30d] [90d] [Todo]              actual: 14.2  ↑ │
│                                                         │
│  20 ┤                                                   │
│  15 ┤                    ╱─────╲────╱─────  ← 14.2     │
│  10 ┤    ╱──╲────────────                              │
│   5 ┤────                                              │
│   1 ┤                                                  │
│     └──────────────────────────────────                │
│       1 may      10 may     20 may                     │
└─────────────────────────────────────────────────────────┘
```

- **Librería:** Recharts (ya instalada vía artifacts; instalar `recharts` si no está en el proyecto).
- **Tipo:** `<AreaChart>` con gradient lineal verde (`stroke #10b981`, `fill url(#dr-gradient)` con stops 30%→0%).
- **Tooltip custom:** "22 may · 14.2 · vs Erik & Gibbon (W +0.3)".
- **Empty state:** "Aún no hay suficientes partidas para mostrar evolución (mínimo 5)".

### Implementación

**Materialización del histórico:**

El rating actual vive en `profile_ratings` (vista), pero necesitamos snapshots por partida.
Si NO existe ya, crear tabla:

```sql
-- supabase/migrations/0011_profile_views.sql (sigue)
create table if not exists public.rating_history (
  user_id uuid not null references auth.users(id) on delete cascade,
  match_id uuid not null references public.matches(id) on delete cascade,
  bucket text not null,                     -- 'singles_d6' | 'doubles_d6' | 'singles_d9' | 'doubles_d9'
  mu numeric not null,
  sigma numeric not null,
  ordinal numeric not null,                 -- mu - 3*sigma
  global_display numeric not null,          -- 1-20 normalizado (Bayesian fusion)
  created_at timestamptz not null default now(),
  primary key (user_id, match_id, bucket)
);

create index if not exists idx_rating_history_user_time
  on public.rating_history (user_id, created_at desc);

alter table public.rating_history enable row level security;

create policy "rating_history_read_all"
  on public.rating_history for select
  to authenticated
  using (true);

-- INSERTs solo desde server (service role) cuando se finaliza partida
```

**Hook en finalize match:** asegúrate de que el server action `finalizeMatch` (en `src/lib/match-actions.ts` o donde esté) escriba un registro en `rating_history` por cada jugador con su `global_display` recalculado.

**RPC para consulta del gráfico:**

```sql
create or replace function public.rating_timeline(
  p_user uuid,
  p_range text default 'all'   -- '7d' | '30d' | '90d' | 'all'
)
returns table (
  match_id uuid,
  created_at timestamptz,
  global_display numeric
)
language sql
security definer
set search_path = public
as $$
  select
    rh.match_id,
    rh.created_at,
    rh.global_display
  from rating_history rh
  where rh.user_id = p_user
    and rh.bucket = 'singles_d6'   -- usamos cualquier bucket; global_display es el mismo
    and (
      p_range = 'all'
      or (p_range = '7d'  and rh.created_at > now() - interval '7 days')
      or (p_range = '30d' and rh.created_at > now() - interval '30 days')
      or (p_range = '90d' and rh.created_at > now() - interval '90 days')
    )
  order by rh.created_at asc;
$$;

grant execute on function public.rating_timeline(uuid, text) to authenticated;
```

**Component:**

```tsx
// src/components/profile/RatingChart.tsx
"use client";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, defs, linearGradient, stop } from "recharts";

export function RatingChart({ userId }: { userId: string }) {
  const [range, setRange] = useState<"7d" | "30d" | "90d" | "all">("30d");
  const [data, setData] = useState<{ t: number; rating: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // call rating_timeline RPC vía supabase browser client
  }, [range, userId]);

  if (loading) return <Skeleton />;
  if (data.length < 5) return <EmptyState />;

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-text">DomiRank Global</h3>
        <RangeTabs value={range} onChange={setRange} />
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="dr-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="t" tickFormatter={fmtDate} stroke="var(--text-mute)" />
          <YAxis domain={[1, 20]} stroke="var(--text-mute)" />
          <Tooltip content={<CustomTooltip />} />
          <Area type="monotone" dataKey="rating" stroke="#10b981" fill="url(#dr-grad)" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
```

### Acceptance criteria
- [ ] El gráfico muestra solo DomiRank Global (1-20) no buckets individuales.
- [ ] Rango por defecto: 30d.
- [ ] Y axis fijo en [1, 20] para que la magnitud sea visualmente comparable entre perfiles.
- [ ] Color verde DomiRank con gradient sutil.
- [ ] Tooltip muestra fecha + rating + delta vs partida anterior.
- [ ] Empty state si <5 puntos.
- [ ] Mobile-friendly (alto 180px en breakpoint sm).
- [ ] El finalizar partida escribe en `rating_history` para todos los jugadores.

---

## P4 — Leaderboard de torneo estilo "Tabla · Jugadores"

### Historia
> **Como** participante o espectador de un torneo
> **quiero** ver la tabla del torneo con columnas claras (V, D, %, PF, PC, ±, Racha)
> **para** entender el standing actual de un vistazo, como en una liga deportiva real.

### Diseño (exacto de la imagen del usuario)

```
┌─ Tabla · Jugadores ─────────────────────────────────────────┐
│                                                             │
│  #   JUGADOR        V    D    %     PF    PC    ±    RACHA  │
│  ──────────────────────────────────────────────────────     │
│  🟡1  Erik         14   11   56%  2305  2049  +256   1W    │
│  ⚪2  Gibbon       12   13   48%  2267  2087  +180   1L    │
│  🟠3  Kako         15   10   60%  2250  2104  +146   2W    │
│  🔵4  Gusi          9   16   36%  1886  2468  -582   3L    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Detalles visuales:**
- Background card oscuro (`bg-bg-2/40`) con border sutil.
- Header con tracking-wider, text-text-mute, text-xs uppercase.
- Posición: badge cuadrado redondeado 28x28 con color por puesto:
  - #1: dorado `#f5b800`
  - #2: plata `#d1d5db`
  - #3: bronce `#cd7f32`
  - resto: `bg-surface-2`, texto blanco
- Nombre: text-text font-medium.
- V (Victorias) en verde (`text-success`).
- D (Derrotas) en gris (`text-text-dim`).
- %: blanco bold.
- PF (Puntos a favor) en blanco.
- PC (Puntos en contra) en gris.
- ±: verde si > 0, rojo si < 0, formato `+256` / `-582`.
- Racha: chip pill
  - W (winning): `bg-success/15 text-success`
  - L (losing): `bg-danger/15 text-danger`
  - texto: "1W", "3L"
- Rows con hover state `bg-surface-2/50`, click → `/u/[username]`.
- Mobile: scroll horizontal nativo (`overflow-x-auto`); columnas con `min-width` fijo.
- Header sticky al hacer scroll vertical en tabletas grandes.

### Implementación

**Donde se renderiza:**

`src/app/tournaments/[id]/TournamentLeaderboard.tsx` (sustituye lo que haya hoy).
Se incluye también en `src/app/tournaments/[id]/page.tsx` (server) cargando los datos.

**RPC `tournament_standings`:**

```sql
-- supabase/migrations/0011_profile_views.sql (sigue)
create or replace function public.tournament_standings(p_tournament uuid)
returns table (
  rank int,
  user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  wins int,
  losses int,
  win_rate int,
  points_for int,
  points_against int,
  diff int,
  streak text                -- '3W' | '1L' | '—'
)
language plpgsql
security definer
set search_path = public
as $$
declare
  rec record;
begin
  return query
  with tp as (
    select tp.user_id, p.username, p.display_name, p.avatar_url
    from tournament_players tp
    join profiles p on p.id = tp.user_id
    where tp.tournament_id = p_tournament
  ),
  match_results as (
    select
      mp.user_id,
      case when mp.team = m.winner_team then 1 else 0 end as won,
      m.finished_at,
      case when mp.team = 1 then m.score_team1 else m.score_team2 end as pf,
      case when mp.team = 1 then m.score_team2 else m.score_team1 end as pc
    from matches m
    join match_players mp on mp.match_id = m.id
    where m.tournament_id = p_tournament
      and m.status = 'finished'
  ),
  agg as (
    select
      user_id,
      sum(won)::int as wins,
      (count(*) - sum(won))::int as losses,
      case when count(*) > 0 then round(100.0 * sum(won) / count(*))::int else 0 end as win_rate,
      coalesce(sum(pf), 0)::int as pf,
      coalesce(sum(pc), 0)::int as pc,
      coalesce(sum(pf) - sum(pc), 0)::int as diff
    from match_results
    group by user_id
  ),
  ranked as (
    select
      tp.user_id,
      tp.username, tp.display_name, tp.avatar_url,
      coalesce(agg.wins, 0) as wins,
      coalesce(agg.losses, 0) as losses,
      coalesce(agg.win_rate, 0) as win_rate,
      coalesce(agg.pf, 0) as pf,
      coalesce(agg.pc, 0) as pc,
      coalesce(agg.diff, 0) as diff,
      row_number() over (
        order by coalesce(agg.wins, 0) desc,
                 coalesce(agg.diff, 0) desc,
                 coalesce(agg.pf, 0) desc
      )::int as rank
    from tp
    left join agg on agg.user_id = tp.user_id
  )
  select
    ranked.rank,
    ranked.user_id,
    ranked.username,
    ranked.display_name,
    ranked.avatar_url,
    ranked.wins,
    ranked.losses,
    ranked.win_rate,
    ranked.pf as points_for,
    ranked.pc as points_against,
    ranked.diff,
    public.calc_streak(ranked.user_id, p_tournament) as streak
  from ranked
  order by ranked.rank asc;
end;
$$;

create or replace function public.calc_streak(p_user uuid, p_tournament uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  s int := 0;
  cur_won boolean;
  rec_won boolean;
  first_set boolean := false;
begin
  for cur_won in
    select case when mp.team = m.winner_team then true else false end
    from matches m
    join match_players mp on mp.match_id = m.id
    where m.tournament_id = p_tournament
      and m.status = 'finished'
      and mp.user_id = p_user
    order by m.finished_at desc
  loop
    if not first_set then
      rec_won := cur_won;
      first_set := true;
      s := 1;
    else
      if cur_won = rec_won then
        s := s + 1;
      else
        exit;
      end if;
    end if;
  end loop;

  if not first_set then return '—'; end if;
  return s::text || (case when rec_won then 'W' else 'L' end);
end;
$$;

grant execute on function public.tournament_standings(uuid) to authenticated;
grant execute on function public.calc_streak(uuid, uuid) to authenticated;
```

**Component:**

```tsx
// src/app/tournaments/[id]/TournamentLeaderboard.tsx
"use client";

type Row = {
  rank: number;
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  wins: number;
  losses: number;
  win_rate: number;
  points_for: number;
  points_against: number;
  diff: number;
  streak: string;
};

const RANK_COLORS: Record<number, string> = {
  1: "bg-[#f5b800] text-black",
  2: "bg-[#d1d5db] text-black",
  3: "bg-[#cd7f32] text-black",
};

export function TournamentLeaderboard({ rows }: { rows: Row[] }) {
  return (
    <section className="card overflow-hidden">
      <header className="px-5 py-4 flex items-center justify-between">
        <h2 className="text-lg font-bold tracking-tight">
          Tabla <span className="text-text-mute">· Jugadores</span>
        </h2>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-text-mute text-xs uppercase tracking-wider border-y border-border">
              <th className="px-4 py-3 text-left w-12">#</th>
              <th className="px-2 py-3 text-left">Jugador</th>
              <th className="px-3 py-3 text-right">V</th>
              <th className="px-3 py-3 text-right">D</th>
              <th className="px-3 py-3 text-right">%</th>
              <th className="px-3 py-3 text-right">PF</th>
              <th className="px-3 py-3 text-right">PC</th>
              <th className="px-3 py-3 text-right">±</th>
              <th className="px-4 py-3 text-right">Racha</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.user_id}
                className="border-b border-border last:border-0 hover:bg-surface-2/50 transition-colors cursor-pointer"
                onClick={() => router.push(`/u/${r.username}`)}
              >
                <td className="px-4 py-3">
                  <span
                    className={`inline-grid place-items-center w-7 h-7 rounded-lg text-xs font-bold ${
                      RANK_COLORS[r.rank] ?? "bg-surface-2 text-text"
                    }`}
                  >
                    {r.rank}
                  </span>
                </td>
                <td className="px-2 py-3 font-medium">{r.display_name || r.username}</td>
                <td className="px-3 py-3 text-right text-success font-semibold">{r.wins}</td>
                <td className="px-3 py-3 text-right text-text-dim">{r.losses}</td>
                <td className="px-3 py-3 text-right font-semibold">{r.win_rate}%</td>
                <td className="px-3 py-3 text-right">{r.points_for}</td>
                <td className="px-3 py-3 text-right text-text-dim">{r.points_against}</td>
                <td className={`px-3 py-3 text-right font-semibold ${r.diff > 0 ? "text-success" : r.diff < 0 ? "text-danger" : "text-text-dim"}`}>
                  {r.diff > 0 ? `+${r.diff}` : r.diff}
                </td>
                <td className="px-4 py-3 text-right">
                  <StreakChip value={r.streak} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function StreakChip({ value }: { value: string }) {
  if (value === "—") return <span className="text-text-mute">—</span>;
  const isW = value.endsWith("W");
  return (
    <span className={`inline-block px-2 py-1 rounded-md text-xs font-bold ${
      isW ? "bg-success/15 text-success" : "bg-danger/15 text-danger"
    }`}>
      {value}
    </span>
  );
}
```

### Acceptance criteria
- [ ] Tabla idéntica al mockup en colores, columnas, alineación.
- [ ] Top 3 con badges dorado / plata / bronce.
- [ ] Rachas en chips con colores verde/rojo según W/L.
- [ ] Click en fila → perfil público (`/u/[username]`).
- [ ] Ordenamiento: wins desc, luego diff desc, luego pf desc.
- [ ] Empty tournament (sin partidas jugadas): muestra todos los participantes con 0/0/0%/0/0/0/—.
- [ ] Mobile: scroll horizontal con momentum nativo, columna # y Jugador sticky.
- [ ] El header sticky al scrollear (en desktop).
- [ ] Tabla reemplaza completamente el leaderboard actual de `/tournaments/[id]`.

---

# Prompt para Claude Code

Copia y pega esto en tu Claude Code después de cerrar Epic O (USER_STORIES_v3.md):

```
Eres senior fullstack engineer trabajando en DomiRank (Next.js 14 App Router,
TypeScript, Tailwind, Supabase). Lee USER_STORIES_v4.md y ejecuta el Epic P
completo, en orden:

  P1 — Página de perfil público /u/[username]
  P2 — Historial de partidas con tab head-to-head
  P3 — Gráfico de evolución del DomiRank Global (Recharts)
  P4 — Leaderboard de torneos estilo "Tabla · Jugadores"

Requisitos no negociables:

1. UNA SOLA MIGRACIÓN: supabase/migrations/0011_profile_views.sql con TODOS los
   objetos nuevos (vistas, RPCs, tabla rating_history). Idempotente: usa
   `create or replace`, `if not exists`, y `drop if exists cascade` cuando sea
   necesario para que pueda re-aplicarse sin errores.

2. RLS estricto en rating_history: SELECT abierto a authenticated, INSERT solo
   desde server con service role.

3. Hook el finalize match (src/lib/match-actions.ts o donde esté la lógica de
   cerrar partida) para que ESCRIBA en rating_history por cada jugador con su
   global_display recalculado. Esto es CRÍTICO o el gráfico nunca tendrá datos.
   Si la función actual no escribe el global_display, calcúlalo ahí mismo con
   la utilidad existente en src/lib/rating.ts (función globalRating).

4. Recharts: si no está en package.json, agrégalo con `npm i recharts`.

5. Reusa componentes existentes: <Avatar>, <FriendActionButton> de Epic O,
   estilos card / btn-primary / btn-ghost del global.css.

6. NO crees páginas markdown extra ni READMEs. Solo el código.

7. Mobile-first: prueba todas las vistas en breakpoint 375px antes de declarar
   terminado.

8. Tipos estrictos: nada de any. Define tipos en src/types/profile.ts si hace
   falta.

9. Cuando termines cada story, corre `npm run build` y arregla cualquier error
   de TypeScript antes de pasar a la siguiente.

10. Al cerrar el Epic, escribe un changelog corto en commit message de un solo
    commit por story (`git add . && git commit -m "feat(profile): P1 public
    profile page"` etc).

Reglas de UX heredadas de v3:
- Empty states siempre con CTA accionable, nunca con texto pelado.
- Loading states con skeletons, no spinners.
- Optimistic UI donde aplique.
- Toasts para confirmaciones (ya hay <Toaster /> instalado).
- Sin tilde en URLs ni en usernames, sí en display_name y textos UI.

Reporta al final:
- Qué archivos creaste y modificaste.
- Qué falta para que el flujo end-to-end ande (ej. correr la migración en
  Supabase).
- Screenshots móvil y desktop de cada vista nueva.
```

---

## Notas para Carlos (no van al prompt)

1. **Pre-flight:** ya debes tener Epic O mergeado (FriendActionButton, notifications, friend-only matches). Si no, ejecuta v3 primero — `<FriendActionButton>` se reusa en P1.

2. **Migración 0011** necesita que existan `match_players`, `matches`, `tournament_players` con la forma actual. Si renombraste algo en v2/v3, ajusta los joins en los RPCs.

3. **Costo de `rating_history`:** una fila por (jugador × partida × bucket). Para 4 buckets y partidas normales (4 jugadores) son 16 filas/partida. A 100 partidas/día son 1.600 filas/día → <600k/año. Tranquilo.

4. **Backfill (importante):** después de aplicar la migración, vas a tener `rating_history` vacío para partidas pasadas. Decisión:
   - **Opción A (recomendada):** dejar el histórico vacío y que arranque desde la primera partida post-migración. El gráfico mostrará "Aún no hay suficientes partidas" hasta que cada jugador acumule 5+.
   - **Opción B:** correr un script de backfill replayando partidas. Más correcto pero más trabajo. Solo vale la pena si tienes ya >50 partidas reales en producción.

5. **Streak en `profile_stats`:** dejé `current_streak` y `best_streak` en 0 en el TODO de la migración. Si lo quieres real desde el día 1, dime y te lo escribo con cursor PL/pgSQL — pero te recomiendo postergarlo y ejercitar solo las stats básicas en la primera ronda.

6. **Búsqueda de jugadores** (para llegar a `/u/[username]`): no la incluí porque está en Epic O (story O3.5 searchFriends). Si no quieres restringirla a "solo amigos para retar", agrégale un endpoint público `searchPlayers(query)` que devuelva usernames sin filtro de friendship.

Sources:
- [USER_STORIES_v4.md](computer:///Users/carlosmartinez/Documents/Claude/Projects/Domino/USER_STORIES_v4.md)
