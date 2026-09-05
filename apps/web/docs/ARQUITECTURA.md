# Arquitectura

```
┌─────────────────────────────────────────────────────────┐
│                     CLIENTE (Next.js)                    │
│                                                          │
│  Server Components ───► supabaseServer()                │
│       │                       │                          │
│       │                       ▼                          │
│  Server Actions ───► submitMatch() ───► updateRatings() │
│       │                                       │          │
│       ▼                                       ▼          │
│  Client Components ◄── supabaseBrowser()  openskill.js  │
└──────┬──────────────────────────────────────────────────┘
       │ HTTPS (cookies de sesión httpOnly)
       ▼
┌─────────────────────────────────────────────────────────┐
│                       SUPABASE                           │
│  ┌──────────────┐   ┌────────────────────────────────┐  │
│  │  Auth        │   │  Postgres                       │  │
│  │  - Email     │   │  - auth.users (gestionada)     │  │
│  │  - Magic     │   │  - public.profiles  + ratings  │  │
│  │    link      │   │  - public.matches               │  │
│  │              │   │  - public.match_players         │  │
│  └──────┬───────┘   │  - vista profile_ratings        │  │
│         │           │  - vista match_feed             │  │
│         │ trigger   │  - RLS en todo                  │  │
│         └──────────►│    public.handle_new_user()     │  │
│                     └────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## Decisiones clave

### 1. ¿Por qué Next.js + Supabase?

- **Velocidad de MVP**: Auth con email, sesiones, DB y APIs autogeneradas vienen incluidas. No hay que escribir backend.
- **Postgres real** (no Firestore). Esquema normalizado, RLS por fila, vistas SQL, transacciones — todo lo que ya se sabe.
- **Portable a móvil nativo**: el día que armes la app de Expo / React Native, usas el mismo cliente `@supabase/supabase-js` apuntando a la misma DB. Cero duplicación de backend.
- **Vercel** despliega sin fricción.

### 2. ¿Por qué OpenSkill?

Ver [`RATING.md`](./RATING.md). Resumen: Elo no maneja equipos ni incertidumbre; Glicko-2 no maneja equipos; TrueSkill es de Microsoft (patentes). OpenSkill (Plackett-Luce / Weng-Lin) cubre todo y es libre.

### 3. Cálculo del rating: server-side, no client-side

`updateRatings` corre en el servidor (dentro de `submitMatch`, que es un Server Action). Razones:
- **Integridad**: el cliente no puede inflar su propio μ enviando ratings inventados.
- **Atomicidad**: lectura de ratings + cálculo + escritura, todo con el mismo cliente Supabase autenticado bajo RLS.
- **Auditable**: cada partida guarda los μ/σ antes y después.

### 4. RLS (Row-Level Security)

Toda escritura va por RLS de Postgres:
- `matches`: solo el `created_by = auth.uid()` puede insertar.
- `match_players`: solo se pueden insertar filas para un match cuyo `created_by` sea el usuario actual.
- `profiles`: cada usuario solo actualiza su propio perfil (incluyendo cambiar username).

Para el MVP esto significa que **quien crea la partida es el "anotador"** y tiene la palabra final sobre el resultado. En v2 podemos requerir confirmación de los otros jugadores.

### 5. Trigger de perfil automático

`handle_new_user()` se dispara cuando Supabase Auth crea un `auth.users` (al primer magic-link de un email nuevo). Genera un `username` derivado del email, garantiza unicidad y crea el `profiles` con ratings iniciales por defecto. El usuario puede cambiar el username después desde su dashboard.

### 6. Vistas SQL

- `profile_ratings`: añade `singles_ordinal` y `doubles_ordinal` calculados (μ−3σ). Ahorra cálculo en cada query del leaderboard.
- `match_feed`: une `matches` con su lista de `match_players` (y profiles) en un solo agregado JSON. Ideal para el detalle de partida.

### 7. Capa de presentación

Tailwind + tokens de color que respetan la paleta del HTML legacy (`#0a1020` bg, `#10b981` primary). Componentes mínimos (`btn-primary`, `card`, `input`, `nav-link`) en `globals.css` para no llenar de utility classes repetitivas.

## Qué no está y va para v2

- Estado intermedio "partida en curso" (registrar mano por mano antes de finalizar).
- Notificaciones por correo.
- Configuración del régimen de puntos (capicúa, tranque, etc.) y validación de score consistente con el regla.
- Anti-fraude / aprobación de partidas por los participantes.
- Estadísticas avanzadas (head-to-head, gráfica de rating en el tiempo).
- Cliente nativo (Expo).
- Torneos y matchmaking sugerido.
