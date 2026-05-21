# DomiRank v2 — Master prompt para Claude Code

> Copia esto entero en una sesión de Claude Code en la raíz de `domino-app/`.
> Está dividido en 5 fases ordenadas. Ejecuta cada fase, verifica el build, comitea, y pasa a la siguiente.

---

## Contexto

DomiRank es una app Next.js 14 (App Router) + TypeScript + Tailwind + Supabase + OpenSkill desplegada en Vercel. Estructura: `domino-app/src/app/` con páginas, `src/components/`, `src/lib/`. Migraciones en `supabase/migrations/0001-0007`. Ya hay sistema de auth (email+password, magic link, Google OAuth), sistema de pollas con visibilidad, partida en vivo con numpad y capicúa, amigos con búsqueda, ranking con DomiRank Global (fusión bayesiana inverse-variance de 4 buckets).

Quiero llevar la app de "MVP funcional" a "se siente como app nativa profesional" + agregar 4 features mayores. Ejecuta las 5 fases en orden.

---

## FASE 1 — Look & feel nativo de app móvil

**Objetivo:** Que cada interacción se sienta como iOS/Android nativo, no como sitio web responsive.

### 1.1 Instalar y wirear framer-motion

```bash
npm install framer-motion
```

Crea `src/components/Motion.tsx` con helpers reusables:
- `<FadeIn>` — fade + slide-up sutil para entrada de páginas
- `<StaggerChildren>` — hijos aparecen escalonados
- `<TapScale>` — wrapper que aplica `whileTap={{ scale: 0.97 }}` a botones
- `<SheetMotion>` — animación de entrada tipo bottom sheet iOS

### 1.2 Page transitions

En `src/components/AppShell.tsx`, envuelve `{children}` con `<AnimatePresence mode="wait">` y un wrapper que detecta `usePathname()` para transición suave entre rutas. Duración 200-250ms, easing iOS-style (cubic-bezier 0.4, 0.0, 0.2, 1).

### 1.3 Skeleton loaders

Crea `src/components/Skeleton.tsx` con:
- `<Skeleton width={..} height={..} />` — barra de loading con pulse animation
- `<SkeletonCard />`, `<SkeletonRow />`, `<SkeletonAvatar size={..} />`

Reemplaza loading states implícitos (donde solo había `<Suspense>` o no había nada) con skeletons en:
- `/leaderboard` (filas de tabla)
- `/dashboard` (cards de rating)
- `/tournaments` (tarjetas de torneo)
- `/friends` (filas de amigos)

### 1.4 Pull-to-refresh

Componente `<PullToRefresh onRefresh={async () => {...}}>` que detecta gesto en mobile. Implementa con framer-motion drag. Aplica en `/dashboard`, `/leaderboard`, `/friends`, `/tournaments`.

### 1.5 Bottom sheets en lugar de modals (mobile)

Crea `<BottomSheet open onClose>` que se anima desde abajo en mobile (<md breakpoint) y es modal centered en desktop. Úsalo para:
- Modal "Cancelar partida" en live match
- "Quitar amigo" confirm en /friends
- Compartir / Más opciones (cualquier menú de "..." en perfiles)

### 1.6 Tap feedback global

En `globals.css`, agrega:
```css
button, [role="button"], a {
  -webkit-tap-highlight-color: transparent;
  user-select: none;
  -webkit-user-select: none;
}
.btn-primary, .btn-ghost, .nav-link {
  transition: transform 80ms ease-out, background-color 150ms;
}
.btn-primary:active, .btn-ghost:active, .nav-link:active {
  transform: scale(0.97);
}
```

### 1.7 Safe areas iOS y dynamic island

En `layout.tsx`, agrega meta viewport:
```html
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" />
```

Asegúrate que el header y bottom nav respetan `env(safe-area-inset-top)` y `env(safe-area-inset-bottom)`.

### 1.8 Touch targets ≥ 44px

Audita todos los botones y links. Los que son menores a 44px de alto (Apple HIG mínimo), pasa a `min-height: 44px` (usa `min-h-11` de Tailwind).

### 1.9 Loading state global durante navegación

Crea componente `<NavigationLoader />` que muestra una barra de progreso al inicio del viewport mientras Next está cargando una nueva ruta. Estilo: 2px alto, color primary, animación shimmer.

### 1.10 Empty states con ilustración

Donde haya listas vacías (sin amigos, sin partidas, sin torneos), reemplaza el texto plano por:
- Icono Tabler grande (48-64px) en color muted
- Título atractivo ("Aún no tienes amigos")
- Subtítulo explicativo
- CTA primario para resolver el vacío

### 1.11 Haptic visual feedback

Para acciones importantes (sumar puntos en live match, finalizar partida, aceptar friend request), agrega un breve "flash" verde de fondo (200ms) tras el éxito.

**Acceptance Fase 1:**
- Navegación entre páginas tiene transición fade+slide.
- Botones reaccionan con scale-down al tocarlos.
- No hay flash blanco al cargar páginas (skeletons en su lugar).
- En iPhone, la app respeta el notch y el home indicator.
- Pull to refresh funciona en las páginas principales.
- Los modals en mobile aparecen como bottom sheets.

---

## FASE 2 — Rename Pollas → Torneo

**Reglas:**
- Internamente las tablas se siguen llamando `tournaments` (no cambies schema).
- En UI, español, siempre "Torneo" (singular) / "Torneos" (plural).
- Archivos `src/app/tournaments/` se quedan así (path en inglés ok).
- Internamente en código las funciones siguen siendo `createTournament`, `tournament_id`, etc.

**Cambios:**

1. Busca todas las ocurrencias case-insensitive de "polla" o "pollas" en `domino-app/src/` y reemplázalas:
   - "Pollas" → "Torneos"
   - "polla" → "torneo"
   - "Polla" → "Torneo"

2. Específicamente:
   - `AppShell.tsx`: label "Pollas" → "Torneos" en bottom nav y sidebar
   - `src/app/tournaments/page.tsx`: título "Pollas" → "Torneos", botón "+ Nueva polla" → "+ Nuevo torneo"
   - `src/app/tournaments/new/`: "Nueva polla" → "Nuevo torneo"
   - `src/app/tournaments/[id]/page.tsx`: "Polla detalle" → "Torneo detalle"
   - `src/app/page.tsx`: home "Pollas activas" → "Torneos activos"
   - `src/lib/tournaments.ts`: mensajes de error
   - `src/lib/auth-actions.ts`: copy si menciona "polla"
   - `terms/page.tsx` y `privacy/page.tsx`: si mencionan "polla"

3. No reemplaces:
   - Nombres de tablas SQL en migraciones
   - Comentarios en código que digan "polla" (puedes dejarlos como aclaración histórica)
   - El campo `name` de torneos existentes en producción (eso es data de usuario)

4. Commit message: `refactor: rename "pollas" → "torneos" en UI (schema intacto)`.

**Acceptance Fase 2:**
- Bottom nav muestra "Torneos".
- Toda la UI en español dice "Torneo/s", no "Polla/s".
- El schema de DB no cambia.
- Build pasa sin errores.

---

## FASE 3 — Múltiples formatos de torneo

**Objetivo:** Reemplazar el actual "Rotación abierta" (único formato) con un selector de formato al crear torneo, con 5 opciones, cada una con su lógica de matchmaking y explicación clara.

### 3.1 Migration 0008 — formato de torneo

Crea `supabase/migrations/0008_tournament_formats.sql`:

```sql
alter table public.tournaments
  add column if not exists format text not null default 'rotation'
    check (format in ('rotation','round_robin','swiss','single_elim','double_elim','points_league'));

-- Estado interno del bracket/standings que el formato necesita
alter table public.tournaments
  add column if not exists current_round integer not null default 0,
  add column if not exists total_rounds  integer;  -- null = abierto

-- Pareos asignados por el formato. Para Swiss/RoundRobin/Elim:
-- (tournament_id, round, board, team_a_players[], team_b_players[], match_id?)
create table if not exists public.tournament_pairings (
  id           bigserial primary key,
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  round        integer not null,
  board        integer not null,
  team_a_user_ids uuid[] not null,
  team_b_user_ids uuid[] not null,
  match_id     uuid references public.matches(id) on delete set null,
  created_at   timestamptz not null default now(),
  unique (tournament_id, round, board)
);
create index if not exists tp_round_idx on public.tournament_pairings (tournament_id, round);

alter table public.tournament_pairings enable row level security;
drop policy if exists tp_read_visible on public.tournament_pairings;
create policy tp_read_visible on public.tournament_pairings for select using (
  exists (select 1 from public.tournaments t where t.id = tournament_id and (
    t.visibility = 'public'
    or t.created_by = auth.uid()
    or exists (select 1 from public.tournament_players tp2 where tp2.tournament_id = t.id and tp2.user_id = auth.uid())
  ))
);
create policy tp_write_creator on public.tournament_pairings for all using (
  exists (select 1 from public.tournaments t where t.id = tournament_id and t.created_by = auth.uid())
);
```

### 3.2 Constantes de formatos

Crea `src/lib/tournament-formats.ts`:

```typescript
export type TournamentFormat = 'rotation' | 'round_robin' | 'swiss' | 'single_elim' | 'double_elim' | 'points_league';

export const TOURNAMENT_FORMATS = {
  rotation: {
    code: 'rotation',
    name: 'Rotación abierta',
    icon: '🔄',
    short: 'Sin estructura fija — eliges 4 jugadores cada partida',
    description: 'Cada partida tomamos 4 jugadores del torneo (sorteo o manual) y los dividimos en 2 parejas. Sin rondas, sin bracket. Standings se calculan por puntos acumulados.',
    pros: ['Flexible: empiezas y paras cuando quieras', 'Ideal para casas de dominó con jugadores rotativos', 'No requiere todos los jugadores presentes'],
    cons: ['Standings menos justos (algunos juegan más que otros)', 'No define un "ganador único" claro'],
    minPlayers: 4,
    maxPlayers: 64,
    durationHint: 'Indefinida (continua) o hasta N partidas',
    fairness: 2, // 1-5
  },
  round_robin: {
    code: 'round_robin',
    name: 'Todos contra todos',
    icon: '⚪',
    short: 'Cada jugador/pareja juega contra todos',
    description: 'Cada equipo enfrenta a cada uno de los demás exactamente una vez. El ganador es quien sume más victorias. Con N equipos hay N*(N-1)/2 partidas.',
    pros: ['Máxima justicia: todos juegan contra todos', 'Standings claros', 'Buen formato para grupos chicos (4-8 equipos)'],
    cons: ['Mucho tiempo con muchos equipos (8 equipos = 28 partidas)', 'Requiere todos presentes o coordinación pesada'],
    minPlayers: 4,
    maxPlayers: 16,
    durationHint: '2-6 horas según equipos',
    fairness: 5,
  },
  swiss: {
    code: 'swiss',
    name: 'Sistema suizo',
    icon: '🇨🇭',
    short: 'Cada ronda emparejas con quien tenga score similar',
    description: 'En cada ronda los equipos se emparejan con otros de score similar acumulado. Sin eliminación: todos juegan todas las rondas. Tras N rondas (típicamente log2(equipos) + 2), el de mejor score gana. Inventado para ajedrez, escala bien a torneos grandes.',
    pros: ['Escala perfectamente a 16-64+ equipos', 'No hay eliminación temprana decepcionante', 'Buen balance entre justicia y duración'],
    cons: ['Requiere algoritmo de pareo (no podés hacerlo a mano)', 'Resultado puede tener empates en score'],
    minPlayers: 6,
    maxPlayers: 128,
    durationHint: '5-9 rondas según equipos',
    fairness: 4,
  },
  single_elim: {
    code: 'single_elim',
    name: 'Eliminación directa',
    icon: '🏆',
    short: 'Pierdes una vez y estás fuera',
    description: 'Bracket clásico estilo Wimbledon. Equipos se emparejan en cuartos/semis/final. Quien pierde queda eliminado. Con N=8 equipos hay 7 partidas. Si N no es potencia de 2, se asignan "byes" a los mejor seedeados.',
    pros: ['Rápido: una sola partida por equipo y ronda', 'Drama y emoción crecientes', 'Resultado inequívoco: un ganador'],
    cons: ['Equipos buenos pueden eliminarse temprano por mala suerte', 'Pocos juegos por equipo (puede ser frustrante)'],
    minPlayers: 4,
    maxPlayers: 64,
    durationHint: '2-4 horas',
    fairness: 3,
  },
  double_elim: {
    code: 'double_elim',
    name: 'Doble eliminación',
    icon: '🥊',
    short: 'Pierdes dos veces para quedar fuera',
    description: 'Bracket con segunda chance: al perder pasas al "loser bracket", y solo quedas eliminado al perder ahí también. La final enfrenta al ganador del winner bracket vs el del loser bracket (este último debe ganar dos veces para llevarse el torneo).',
    pros: ['Más justo que eliminación simple', 'Permite recuperarse de un mal día'],
    cons: ['Más partidas (~2× single elim)', 'Complejo de visualizar para nuevos jugadores'],
    minPlayers: 4,
    maxPlayers: 32,
    durationHint: '4-7 horas',
    fairness: 4,
  },
  points_league: {
    code: 'points_league',
    name: 'Liga por puntos',
    icon: '📊',
    short: 'Acumula puntos a lo largo del tiempo',
    description: 'Torneo sin estructura fija pero con duración definida (ej. "Liga marzo"). Cada partida ganada da puntos (configurable: 3 por ganar a 100, 5 por ganar a 200, etc.). Al cerrar la liga, los más puntos ganan. Ideal para grupos que juegan irregularmente durante semanas.',
    pros: ['Perfecto para grupos no presenciales (WhatsApp leagues)', 'Premia consistencia, no día específico', 'Puede correr semanas o meses'],
    cons: ['Final puede ser predecible si alguien lleva mucha ventaja', 'Requiere disciplina de registrar partidas'],
    minPlayers: 4,
    maxPlayers: 50,
    durationHint: '1-8 semanas',
    fairness: 4,
  },
} as const;

export type TournamentFormatInfo = typeof TOURNAMENT_FORMATS[TournamentFormat];
```

### 3.3 Página de explicación de formatos `/torneos/formatos`

Crea ruta `/torneos/formatos` (o como prefiera Next, mantenla en español por SEO):
- Lista las 6 modalidades como tarjetas grandes
- Cada tarjeta: ícono, nombre, short description, expandible para ver Pros / Contras / Duración / Justicia (con barra visual 1-5)
- CTA al final: "Crear torneo →"
- Linkea desde el botón "?" o "Cómo elegir formato" en el form de crear torneo

### 3.4 Update form de crear torneo

En `src/app/tournaments/new/NewTournamentForm.tsx`:
- Reemplaza el dropdown actual de modalidad de juego (Venezolano/Dominicano/etc., que sigue existiendo) con dos selectores claros separados:
  - **Modalidad de juego** (Venezolano, Dominicano, etc.) — esto define reglas
  - **Formato del torneo** (Rotación, Round robin, Suizo, etc.) — esto define cómo se emparejan
- Para "Formato del torneo", muestra cards con ícono + nombre + short. Click expande detalle.
- Link "ℹ️ Cómo elegir formato" abajo del selector → abre `/torneos/formatos` en nueva pestaña o bottom sheet inline.

### 3.5 Server actions para cada formato

En `src/lib/tournament-formats-engine.ts`, implementa:

```typescript
// Genera pareos de la ronda 1 (todos los formatos)
export async function generateInitialPairings(tournamentId: string): Promise<void>;

// Después de finalizar todas las partidas de una ronda, genera la siguiente
export async function generateNextRound(tournamentId: string): Promise<{ done: boolean; nextRound?: number }>;

// Calcula standings según el formato
export async function computeStandings(tournamentId: string): Promise<Standing[]>;
```

Algoritmos:
- **rotation**: no se generan pareos automáticos (el creador elige 4 cada partida).
- **round_robin**: Round-robin scheduling clásico (Berger tables). N(N-1)/2 partidas en N-1 (o N) rondas.
- **swiss**: En cada ronda, ordena equipos por score, empareja 1-2 / 3-4 / etc. evitando rematches. Maneja byes si N impar.
- **single_elim**: Bracket con seeding (mejor rated vs peor rated en R1). Avanza ganadores.
- **double_elim**: Winner bracket + loser bracket. Avanza según corresponda.
- **points_league**: No genera pareos; los participantes crean partidas libremente entre ellos.

### 3.6 Vista de torneo según formato

En `/tournaments/[id]/page.tsx`, condiciona la UI:
- **rotation**: vista actual (lista de partidas + standings simples).
- **round_robin / swiss**: mostrar grid de rondas con sus pareos. Cada pareo es clickable (lleva a la partida).
- **single_elim / double_elim**: bracket visual (componente `<Bracket />` que dibuja líneas conectando partidas).
- **points_league**: como rotation pero con tabla de puntos acumulados visible y fecha de cierre.

### 3.7 Bracket visual component

Componente `<Bracket tournamentId>` que:
- Fetch tournament_pairings
- Renderiza en columnas (cuartos → semis → final)
- Líneas conectoras SVG entre partidas relacionadas
- Click en pareo → abrir el match (si existe) o crear el match si soy el creador

**Acceptance Fase 3:**
- Crear torneo permite elegir entre 6 formatos.
- Cada formato tiene su explicación accesible desde el form.
- `/torneos/formatos` existe y explica los 6 formatos en detalle.
- Round robin genera pareos correctos automáticamente.
- Swiss empareja por score similar en cada ronda.
- Single elim muestra bracket visual.
- Standings se calculan correctamente según el formato.

---

## FASE 4 — Self-assessment de skill inicial (estilo Playtomic)

**Objetivo:** Cuando un usuario nuevo termine el onboarding (país + modalidad), agregar un tercer paso con cuestionario de skill. Sus respuestas determinan μ/σ iniciales en vez de los defaults.

### 4.1 Cuestionario

Tras seleccionar modalidad, paso 3: "Cuéntanos sobre tu nivel". 4 preguntas:

**P1. ¿Cuánto tiempo llevas jugando dominó?**
- (0pt) Soy nuevo (< 1 año)
- (1pt) Un par de años (1-5 años)
- (2pt) Llevo años jugando (5-15 años)
- (3pt) Toda la vida (15+ años)

**P2. ¿Con qué frecuencia juegas?**
- (0pt) Rara vez
- (1pt) Casual (1-2 veces por semana)
- (2pt) Frecuente (3+ veces por semana)
- (3pt) Casi diario

**P3. ¿Has competido en torneos?**
- (0pt) Nunca
- (1pt) En familia / casa
- (2pt) Torneos locales
- (3pt) Torneos regionales o nacionales

**P4. ¿Cómo te calificarías?**
- (0pt) Aún aprendo las reglas
- (1pt) Defiendo bien contra cualquiera
- (2pt) Suelo ganarle a la mayoría
- (3pt) Soy de los mejores de mi círculo

Total: 0-12 puntos.

### 4.2 Mapeo a (μ, σ) inicial

```typescript
export function initialRatingFromAssessment(points: number): { mu: number; sigma: number; estimatedDisplay: number } {
  // Tramos basados en 0-12 puntos
  if (points <= 2) return { mu: 22, sigma: 7.5, estimatedDisplay: 3 };
  if (points <= 5) return { mu: 25, sigma: 7.0, estimatedDisplay: 6 };
  if (points <= 8) return { mu: 28, sigma: 6.5, estimatedDisplay: 9 };
  if (points <= 10) return { mu: 31, sigma: 5.5, estimatedDisplay: 13 };
  return { mu: 33, sigma: 4.5, estimatedDisplay: 16 };
}
```

Notas:
- σ se reduce levemente con más puntos (asumimos que un veterano tiene rating menos volátil), pero queda lo suficientemente alto para que las primeras 10-15 partidas corrijan rápidamente.
- μ aumenta con más puntos.
- El display estimado se le muestra al usuario al final como "Empiezas en ~9.0 — esto se ajustará con tus primeras partidas."

### 4.3 Aplicación del rating inicial

En `src/app/onboarding/actions.ts`, server action `saveOnboarding` debe aceptar también el `skill_points` y aplicar el rating inicial a TODOS los 4 buckets del usuario:
- `singles_mu`, `singles_sigma` → del mapeo
- `doubles_mu`, `doubles_sigma` → del mapeo
- `d9_singles_mu`, `d9_singles_sigma` → del mapeo
- `d9_doubles_mu`, `d9_doubles_sigma` → del mapeo

Migration adicional opcional: `alter table profiles add column initial_skill_points int` para auditar.

### 4.4 UI del cuestionario

Componente `<SkillAssessment onComplete={(points) => ...}>`:
- Una pregunta visible a la vez (paso 3.1 → 3.2 → 3.3 → 3.4).
- Animación de transición entre preguntas (slide-left).
- Progress bar arriba (1/4, 2/4, 3/4, 4/4).
- Opciones como cards grandes seleccionables con tap.
- Botón "Atrás" en cada paso para corregir.

Al final, pantalla de resumen: "Tu rating inicial será **~9.0**. Esto se ajustará con tus primeras partidas." Botón "Empezar a jugar" finaliza onboarding.

### 4.5 Skip explícito

Botón pequeño abajo: "Prefiero no decir — empezar como principiante". Si lo presionan, usa defaults (μ=25, σ=8.33).

**Acceptance Fase 4:**
- Tras el onboarding existente (país + modalidad), aparece un paso 3 con 4 preguntas.
- Las respuestas determinan μ/σ iniciales que se persisten en profiles.
- El usuario ve su rating inicial estimado al final.
- Botón "skip" funciona y deja defaults.
- Veteranos no pegan 30 partidas pareados contra novatos (porque arrancan más alto).

---

## FASE 5 — Rating display normalizado 1-20

**Objetivo:** El número que ve el usuario en todas las pantallas es 1.0-20.0. Internamente seguimos con μ/σ.

### 5.1 Función de mapeo

En `src/lib/rating.ts`, agrega:

```typescript
/**
 * Mapea el ordinal de OpenSkill (μ-3σ, rango ~0-50) a la escala DomiRank 1-20.
 *
 * Anclas:
 *   ordinal 0   → display 1   (acabas de empezar)
 *   ordinal 10  → display 6.4 (casual mejorando)
 *   ordinal 20  → display 11.9 (sólido)
 *   ordinal 30  → display 17.3 (experto)
 *   ordinal 35+ → display 20   (techo)
 */
export function toDisplayRating(ordinal: number): number {
  if (!isFinite(ordinal)) return 1.0;
  const raw = 1 + (ordinal / 35) * 19;
  return Math.max(1.0, Math.min(20.0, Math.round(raw * 10) / 10));
}

/**
 * Inverso: convierte un display rating a aproximadamente un ordinal.
 * Útil para calcular μ inicial desde un assessment.
 */
export function displayToOrdinal(display: number): number {
  return ((display - 1) / 19) * 35;
}
```

### 5.2 Update view SQL para incluir display rating

Migration `0009_display_rating.sql`:

```sql
create or replace function public.to_display_rating(ordinal numeric)
returns numeric language sql immutable as $$
  select greatest(1.0, least(20.0, round((1 + (ordinal / 35) * 19) * 10) / 10))::numeric(4,1)
$$;

-- Recrear profile_ratings view incluyendo columnas *_display
drop view if exists public.profile_ratings cascade;
create or replace view public.profile_ratings as
with combined as (
  select p.*,
    1.0 / (p.singles_sigma * p.singles_sigma) as p_s6,
    1.0 / (p.doubles_sigma * p.doubles_sigma) as p_d6,
    1.0 / (p.d9_singles_sigma * p.d9_singles_sigma) as p_s9,
    1.0 / (p.d9_doubles_sigma * p.d9_doubles_sigma) as p_d9
  from public.profiles p
)
select
  c.id, c.username, c.display_name, c.avatar_url,
  c.country, c.default_modality, c.onboarded,
  c.created_at, c.updated_at,
  c.singles_mu as d6_singles_mu, c.singles_sigma as d6_singles_sigma,
  c.singles_games as d6_singles_games, c.singles_wins as d6_singles_wins, c.singles_losses as d6_singles_losses,
  (c.singles_mu - 3 * c.singles_sigma)::numeric(10,4) as d6_singles_ordinal,
  public.to_display_rating(c.singles_mu - 3 * c.singles_sigma) as d6_singles_display,
  c.doubles_mu as d6_doubles_mu, c.doubles_sigma as d6_doubles_sigma,
  c.doubles_games as d6_doubles_games, c.doubles_wins as d6_doubles_wins, c.doubles_losses as d6_doubles_losses,
  (c.doubles_mu - 3 * c.doubles_sigma)::numeric(10,4) as d6_doubles_ordinal,
  public.to_display_rating(c.doubles_mu - 3 * c.doubles_sigma) as d6_doubles_display,
  c.d9_singles_mu, c.d9_singles_sigma, c.d9_singles_games, c.d9_singles_wins, c.d9_singles_losses,
  (c.d9_singles_mu - 3 * c.d9_singles_sigma)::numeric(10,4) as d9_singles_ordinal,
  public.to_display_rating(c.d9_singles_mu - 3 * c.d9_singles_sigma) as d9_singles_display,
  c.d9_doubles_mu, c.d9_doubles_sigma, c.d9_doubles_games, c.d9_doubles_wins, c.d9_doubles_losses,
  (c.d9_doubles_mu - 3 * c.d9_doubles_sigma)::numeric(10,4) as d9_doubles_ordinal,
  public.to_display_rating(c.d9_doubles_mu - 3 * c.d9_doubles_sigma) as d9_doubles_display,
  ((c.singles_mu * c.p_s6 + c.doubles_mu * c.p_d6 + c.d9_singles_mu * c.p_s9 + c.d9_doubles_mu * c.p_d9)
    / (c.p_s6 + c.p_d6 + c.p_s9 + c.p_d9))::numeric(10,4) as global_mu,
  sqrt(1.0 / (c.p_s6 + c.p_d6 + c.p_s9 + c.p_d9))::numeric(10,4) as global_sigma,
  public.calc_global_ordinal_v2(
    c.singles_mu, c.singles_sigma, c.singles_games,
    c.doubles_mu, c.doubles_sigma, c.doubles_games,
    c.d9_singles_mu, c.d9_singles_sigma, c.d9_singles_games,
    c.d9_doubles_mu, c.d9_doubles_sigma, c.d9_doubles_games
  ) as global_ordinal,
  public.to_display_rating(public.calc_global_ordinal_v2(
    c.singles_mu, c.singles_sigma, c.singles_games,
    c.doubles_mu, c.doubles_sigma, c.doubles_games,
    c.d9_singles_mu, c.d9_singles_sigma, c.d9_singles_games,
    c.d9_doubles_mu, c.d9_doubles_sigma, c.d9_doubles_games
  )) as global_display,
  (c.singles_games + c.doubles_games + c.d9_singles_games + c.d9_doubles_games) as total_games
from combined c;

grant select on public.profile_ratings to anon, authenticated;
```

### 5.3 Update UI a usar display

Reemplaza en TODOS los lugares donde se muestra ordinal con 1 decimal por el display:

- `src/app/leaderboard/page.tsx`: columna Rating muestra `r.global_display` (o el bucket correspondiente).
- `src/app/dashboard/page.tsx`: el número grande del DomiRank Global es `gr.display` (calculado client-side con `toDisplayRating(gr.ordinal)`).
- `src/app/profile/[username]/page.tsx`: idem.
- `src/app/page.tsx` (home top 5): `p.global_display`.
- `src/app/matches/[id]/page.tsx` (detalle de partida): mostrar el cambio en display también, ej. "8.2 → 9.1 (+0.9)".

### 5.4 Tooltip explicativo

En cualquier lugar donde aparezca el rating display (sobre todo dashboard y profile), agrega un pequeño "ⓘ" que al hacer hover/tap muestra:

> Tu rating va de 1 a 20.
> 1 = principiante · 10 = jugador sólido · 20 = nivel profesional.
> Se calcula con OpenSkill (Plackett-Luce) y mide tu skill real comparando con tus rivales.

### 5.5 Niveles nombrados (opcional, gamificación)

Define tiers con nombres llamativos para gamificar:

```typescript
export const SKILL_TIERS = [
  { min: 1,    max: 3.9,  name: 'Aprendiz',     color: '#94a3b8' },
  { min: 4,    max: 6.9,  name: 'Casual',       color: '#10b981' },
  { min: 7,    max: 9.9,  name: 'Habilidoso',   color: '#3b82f6' },
  { min: 10,   max: 12.9, name: 'Veterano',     color: '#8b5cf6' },
  { min: 13,   max: 15.9, name: 'Maestro',      color: '#f59e0b' },
  { min: 16,   max: 17.9, name: 'Élite',        color: '#ef4444' },
  { min: 18,   max: 20,   name: 'Leyenda',      color: '#fbbf24' },
];

export function tierFor(display: number) {
  return SKILL_TIERS.find(t => display >= t.min && display <= t.max) ?? SKILL_TIERS[0];
}
```

Aplica en perfil: badge debajo del rating número grande, con el color del tier.

### 5.6 Update assessment de Fase 4

En la pantalla de resumen del assessment, muestra el display estimado (1-20) en vez del μ raw.

**Acceptance Fase 5:**
- Toda la UI muestra ratings en escala 1.0-20.0.
- Tooltip explica el rango.
- Migration 0009 aplicada en Supabase.
- Tier badge aparece en perfiles.
- Math interno (μ/σ) sigue igual.

---

## Orden de ejecución

1. **Fase 1** (look & feel) — 2-3 horas. Polish antes que features.
2. **Fase 2** (rename) — 30 min. Rápido y limpio.
3. **Fase 5** (display 1-20) — 1-2 horas. Antes que assessment porque el assessment muestra el display.
4. **Fase 4** (skill assessment) — 2 horas.
5. **Fase 3** (formatos de torneo) — 4-6 horas. La más grande, déjala al final.

Tras cada fase: build local (`npm run build`), test del flujo afectado, commit, push (Vercel deploy automático).

## Notas de implementación

- Mantén el código existente funcionando durante toda la migración. Nada de borrar pollas existentes.
- Si una migration falla por columnas que ya existen, usa `add column if not exists`.
- Las modalidades de juego (Venezolano, Dominicano…) y los formatos de torneo (Suizo, Round Robin…) son conceptos ortogonales: un torneo tiene UNA modalidad de juego Y UN formato. Asegúrate de que la UI lo refleje claramente.
- Para la animación de page transitions, prueba en mobile real — algunos browsers no soportan View Transitions API.
- Para los brackets, recurre a una librería ligera como `react-bracket` o haz tu propio SVG. No te metas con D3 — overkill.

## Done definition

Al terminar las 5 fases:
- App se siente como nativa al usar en el teléfono.
- Toda la UI dice "Torneo" en español.
- Puedo crear un torneo Suizo de 16 personas y la app me genera pareos automáticamente.
- Un nuevo usuario hace 4 preguntas y arranca con un rating ajustado a su nivel real.
- En cualquier pantalla veo mi rating como "8.5" en vez de "14.32" o "28.91".
