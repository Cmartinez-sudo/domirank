# Claude Code Prompt — Tournament Leaderboard v2

Supersede el componente básico de `USER_STORIES_v4.md → P4`. Este prompt agrega polish + información extra que la versión inicial no tenía.

---

## Prompt

```
Eres senior fullstack engineer + senior product designer trabajando en
DomiRank (Next.js 14 App Router, TypeScript, Tailwind, Supabase). Vas a
rediseñar el leaderboard de torneos para que sea la "card hero" de la app
— la que la gente va a screenshotear y compartir en WhatsApp.

OBJETIVO: reemplazar la tabla actual de /tournaments/[id] por una versión
con mucho más polish, información útil y capacidad de compartir.

═══════════════════════════════════════════════════════════════════════════
DISEÑO BASE (mantén estos elementos del mockup actual)
═══════════════════════════════════════════════════════════════════════════

Card oscuro con header "Tabla · Jugadores". Columnas:
  #  JUGADOR  V  D  %  PF  PC  ±  RACHA

Top 3 con badges de color:
  • #1 dorado (#f5b800)
  • #2 plata (#d1d5db)
  • #3 bronce (#cd7f32)
  • resto bg-surface-2 neutral

Colores:
  • V (victorias) → text-success verde
  • D (derrotas) → text-text-dim gris
  • % → blanco bold
  • PF → blanco
  • PC → text-text-dim
  • ± → verde si >0, rojo si <0
  • Racha → chip pill: W bg-success/15 text-success, L bg-danger/15 text-danger

═══════════════════════════════════════════════════════════════════════════
MEJORAS SOBRE EL MOCKUP — lo que hace este leaderboard "mejor"
═══════════════════════════════════════════════════════════════════════════

1. AVATAR junto al nombre
   - 28px circular antes del nombre
   - Fallback a iniciales sobre gradiente verde (reusa <Avatar>)
   - Espaciado: gap-3 entre avatar y nombre
   - En el ranking #1, el avatar tiene un anillo dorado sutil (ring-2 ring-[#f5b800]/40)

2. INDICADOR DE MOVIMIENTO (cambio de posición vs ronda anterior)
   - Pequeño chip al lado del badge del rank
   - "↑3" verde si subió, "↓2" rojo si bajó, "—" gris si igual
   - Si es un torneo nuevo sin ronda previa, no se muestra
   - Implementa snapshot diario o por-ronda según trigger del torneo (ver migración)

3. FORMA — últimos 5 partidos del jugador EN ESTE TORNEO
   - 5 dots de 8px (rounded-sm) ANTES del chip de racha
   - Verde si W, rojo si L
   - Si jugó menos de 5, muestra solo los que tiene + dots vacíos grises
   - Orden: más viejo a la izquierda, más reciente a la derecha
   - El chip de racha actual queda al final (1W, 3L, etc.)

4. FILA DEL VIEWER RESALTADA
   - Si el usuario logueado está en la tabla, su fila:
     • Border izquierdo de 3px en text-primary
     • Bg ligeramente más claro (bg-surface-2/30)
     • Tooltip "Esa eres tú" al hover (solo desktop)

5. CLICK EN FILA → PERFIL PÚBLICO
   - router.push(`/u/${username}`)
   - Hover state: bg-surface-2/50 + cursor-pointer
   - Chevron derecho › sutil aparece en hover en desktop

6. TOOLTIPS EN HEADERS
   - V → "Victorias"
   - D → "Derrotas"
   - % → "Porcentaje de victorias"
   - PF → "Puntos a favor — total acumulado"
   - PC → "Puntos en contra — total acumulado"
   - ± → "Diferencial (PF - PC)"
   - Racha → "Resultados consecutivos del mismo signo"
   - Implementa con Radix Tooltip o componente propio. Mobile: long-press.

7. BUSCAR JUGADOR (filtro live)
   - Input arriba de la tabla, placeholder "Buscar jugador..."
   - Filtra por display_name o username (case-insensitive, contains)
   - Se oculta automáticamente si hay <8 jugadores en el torneo (no aporta)
   - Resalta el match en el nombre (text-primary en la parte que coincide)

8. SORT POR COLUMNA
   - Click en header de columna → ordena asc/desc por esa stat
   - Default: por rank (W desc, ± desc, PF desc)
   - Indicador visual de columna activa (flechita pequeña)
   - Click de nuevo invierte sentido. Tercer click vuelve a default rank.

9. REALTIME UPDATES
   - Supabase Realtime subscribe a `matches` filtrado por tournament_id
   - Cuando un match de este torneo pasa a 'confirmed' → re-fetch standings
   - Animar las filas que cambiaron de posición (transición de translate-y)
   - Pequeño badge "Actualizado hace Xs" en el header (relativo, formato "hace 2 min")

10. SKELETON LOADING
    - Mientras carga, muestra 6 filas skeleton con shimmer
    - Bg gris-claro animado tipo bg-gradient-to-r animate-pulse
    - NO uses spinner

11. EMPTY STATE
    - Si el torneo no tiene partidas jugadas todavía:
        🎲
        "Aún no hay partidas en este torneo"
        "Las stats aparecerán cuando se confirmen los primeros resultados"
        [Crear primera partida del torneo]  ← solo visible si viewer es organizador
    - Todos los jugadores con 0/0/—/0/0/0/—/— se ocultan en empty state

12. MOBILE STICKY COLUMNS
    - En horizontal scroll, # y Jugador quedan sticky (con sombra sutil a la derecha)
    - Resto de columnas hacen scroll horizontal con momentum nativo
    - Min-width por columna para que no se compriman

13. BOTÓN "COMPARTIR TABLA" (export como PNG)
    - Top-right del card, ícono share + texto en desktop, solo ícono en mobile
    - Al click:
      a) Captura el card como imagen usando `html-to-image` (npm install)
      b) Agrega un footer al PNG con "DomiRank • domirank.app" + logo
      c) En mobile: usa Web Share API si está disponible
         (navigator.share con file Blob)
      d) En desktop / sin Web Share: descarga directa como PNG
    - Mientras genera la imagen: botón en estado loading con spinner
    - El PNG generado debe verse limpio (sin scrollbars, sin hover states activos)
    - Resolución 2x para retina

═══════════════════════════════════════════════════════════════════════════
DATA LAYER — actualizaciones al RPC tournament_standings
═══════════════════════════════════════════════════════════════════════════

El RPC `public.tournament_standings(p_tournament uuid)` de v4 P4 debe
extenderse para devolver:

  • prev_rank int        -- ranking en el snapshot anterior (NULL si no hay)
  • last5 text[]         -- array de los últimos 5 resultados: ['W','L','W','W','L']

Para `last5`:

```sql
-- subconsulta dentro del CTE 'agg' o como columna extra
(
  select array_agg(
    case when mp.team = m.winner_team then 'W' else 'L' end
    order by m.finished_at desc
  )
  from (
    select mp.user_id, mp.team, m.winner_team, m.finished_at
    from matches m
    join match_players mp on mp.match_id = m.id
    where m.tournament_id = p_tournament
      and m.status = 'confirmed'
      and mp.user_id = ranked.user_id
    order by m.finished_at desc
    limit 5
  ) recent
) as last5
```

Para `prev_rank`, crea tabla snapshot:

```sql
create table if not exists public.tournament_rank_snapshots (
  tournament_id uuid not null references tournaments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rank int not null,
  snapshot_at timestamptz not null default now(),
  primary key (tournament_id, user_id, snapshot_at)
);

create index if not exists idx_rank_snap_lookup
  on public.tournament_rank_snapshots (tournament_id, snapshot_at desc);
```

Y un trigger o cron que tome snapshot cada vez que se confirma una partida
del torneo (o diario, lo que prefieras — empieza con: snapshot DESPUÉS de
cada match confirmado del torneo).

El RPC busca el snapshot más reciente PREVIO al último match para calcular
prev_rank. Si no hay snapshot previo, prev_rank = null.

═══════════════════════════════════════════════════════════════════════════
ARCHIVOS A CREAR / MODIFICAR
═══════════════════════════════════════════════════════════════════════════

Crear:
  • src/app/tournaments/[id]/TournamentLeaderboard.tsx (Client, reemplaza el actual)
  • src/components/leaderboard/RankBadge.tsx        — badge cuadrado con color por posición
  • src/components/leaderboard/MovementIndicator.tsx — ↑3 / ↓2 / —
  • src/components/leaderboard/FormDots.tsx          — 5 dots W/L
  • src/components/leaderboard/StreakChip.tsx        — chip 1W / 3L
  • src/components/leaderboard/ShareTableButton.tsx  — botón export PNG
  • src/components/leaderboard/LeaderboardSkeleton.tsx
  • src/components/leaderboard/LeaderboardEmpty.tsx
  • src/components/ui/Tooltip.tsx                    — si no existe ya
  • src/hooks/useTournamentRealtimeStandings.ts      — Supabase Realtime + state

Modificar:
  • supabase/migrations/0013_tournament_leaderboard_v2.sql
    (agregar tournament_rank_snapshots + actualizar tournament_standings RPC)
  • src/app/tournaments/[id]/page.tsx (server) — pasar viewer_id + initial standings

═══════════════════════════════════════════════════════════════════════════
DEPENDENCIAS A INSTALAR
═══════════════════════════════════════════════════════════════════════════

  npm install html-to-image
  npm install @radix-ui/react-tooltip   (si vas a usar Radix; si tienes tu propio
                                          tooltip, ignora)

═══════════════════════════════════════════════════════════════════════════
ACCEPTANCE CRITERIA (validar antes de mergear)
═══════════════════════════════════════════════════════════════════════════

[ ] Tabla idéntica al mockup en colores, columnas, alineación.
[ ] Top 3 con badges dorado / plata / bronce y avatar del #1 con anillo.
[ ] Cada fila tiene avatar 28px antes del nombre.
[ ] Indicador de movimiento (↑/↓/—) visible al lado del rank cuando hay
    snapshot previo. Oculto si no.
[ ] Forma de últimos 5 partidos visible como 5 dots antes de la racha.
[ ] Mi propia fila (viewer logueado) tiene border izquierdo accent.
[ ] Click en cualquier fila → /u/[username].
[ ] Tooltip en cada header de columna explicando qué significa.
[ ] Buscador filtra en vivo cuando hay >=8 jugadores.
[ ] Sort por click en cualquier header funciona (asc/desc/default).
[ ] Realtime: cuando se confirma un match del torneo, la tabla se actualiza
    en <5s sin recargar página.
[ ] Skeleton mientras carga (no spinner).
[ ] Empty state correcto cuando no hay partidas.
[ ] Mobile: # y Jugador sticky en scroll horizontal.
[ ] Tap targets mínimo 44px en mobile.
[ ] Botón "Compartir tabla" genera PNG limpio con footer DomiRank.
[ ] El PNG generado se ve igual de bien en WhatsApp e Instagram Stories
    (probar con resolución 2x retina).
[ ] `npm run build` sin errores TypeScript.

═══════════════════════════════════════════════════════════════════════════
REGLAS GENERALES
═══════════════════════════════════════════════════════════════════════════

• Filtra TODO por matches.status = 'confirmed' (los pending no afectan tabla).
• Reusa <Avatar> existente, no crees uno nuevo.
• Tipos estrictos: nada de any. Define tipos en src/types/leaderboard.ts.
• Tailwind core utility classes solamente.
• Performance: el realtime subscribe debe cleanupse en unmount (useEffect return).
• No animaciones excesivas — sutiles y rápidas (150-250ms).
• Comments en código solo cuando el "por qué" no sea obvio.

═══════════════════════════════════════════════════════════════════════════
REPORTE FINAL
═══════════════════════════════════════════════════════════════════════════

Al terminar, reporta:
  • Lista de archivos creados/modificados.
  • Screenshot mobile (375px) de la tabla con datos seed.
  • Screenshot desktop (1280px) de la tabla con datos seed.
  • Screenshot del PNG generado por "Compartir tabla".
  • Cualquier paso pendiente (correr migración, configurar realtime, etc.).
```

---

## Notas para Carlos (no van al prompt)

1. **Realtime + Supabase plan:** Supabase Free incluye 2 conexiones concurrentes de Realtime. Para producción con muchos torneos abiertos en simultáneo vas a necesitar Pro. Por ahora no es bloqueador.

2. **Snapshot strategy:** dejé al snapshot dispararse después de cada match confirmado. Eso significa que `prev_rank` es "el ranking justo antes del último match". Para torneos con muchos matches diarios eso es ruidoso. Si prefieres "el ranking de ayer" (snapshot diario via cron), dime y te ajusto la query.

3. **`html-to-image` vs `dom-to-image-more`:** ambos sirven. html-to-image es más mantenido. Si te da problemas con la rasterización de avatares o gradients, pasa a `html2canvas` que es más robusto pero pesado.

4. **El PNG compartible**: vale la pena agregarle un footer con el logo + URL `domirank.app` y la fecha del torneo. Es marketing gratis cuando alguien lo pega en WhatsApp. Eso ya está en el prompt.

5. **Cuándo correr esto**: idealmente DESPUÉS de Epic Q (attestation), porque el filtro `status = 'confirmed'` necesita que el modelo de attestation ya esté en su lugar. Si ejecutas esto antes, ajusta a `status = 'finished'` y migra después.

Sources:
- [LEADERBOARD_PROMPT.md](computer:///Users/carlosmartinez/Documents/Claude/Projects/Domino/LEADERBOARD_PROMPT.md)
