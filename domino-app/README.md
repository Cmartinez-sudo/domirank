# DomiRank

App tipo chess.com para dominó, con rating **OpenSkill** (modelo Plackett-Luce con aproximaciones analíticas Weng-Lin). Stack: **Next.js 14 (App Router) + TypeScript + Tailwind + Supabase**.

> Para ver la UI completa sin instalar nada, abre `../preview.html` en el navegador — incluye todas las pantallas, pollas, explainer interactivo y avatares.

## Qué hay en v1 (MVP)

- Registro / login con **enlace mágico al correo** (sin contraseñas).
- Perfil con dos ratings independientes: **singles (1v1)** y **parejas (2v2)**.
- Crear partida, registrar resultado, los ratings se recalculan automáticamente.
- **Leaderboard** global por formato (singles y parejas).
- **Perfil público** por usuario, con historial segmentado por 15 / 30 / 90 días.
- **Pollas** (torneos por rotación) con standings, racha, modo continuo y toggle rankeada.
- **Avatares** con upload o iniciales con color generado.
- **Página explainer** interactiva del modelo OpenSkill.
- Snapshot de μ/σ antes y después en cada partida (auditable).

## Cómo correrlo en local

### 1. Instalar dependencias

```bash
cd domino-app
npm install
```

### 2. Crear proyecto en Supabase

1. Ve a https://supabase.com → "New project".
2. Elige una región cercana y guarda la contraseña de Postgres.
3. Cuando esté listo, abre **SQL Editor** y ejecuta en orden:

   ```
   supabase/migrations/0001_init.sql                  # esquema base: profiles, matches, match_players, RLS
   supabase/migrations/0002_tournaments_avatars.sql   # pollas + storage de avatars
   ```

4. **Storage → New bucket → `avatars` → Public**. Las policies ya las creó la migración 0002.

5. En **Authentication → Providers** asegúrate de que **Email** esté activado. En **URL Configuration** añade `http://localhost:3000/auth/callback` y luego la URL de tu deploy.

### 3. Variables de entorno

Copia `.env.example` a `.env.local` y rellena:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

Las encuentras en Supabase → **Settings → API**.

### 4. Correr

```bash
npm run dev
```

Abre http://localhost:3000.

### 5. Verificar el motor de rating

```bash
npm run test:rating
```

Corre 6 escenarios contra el motor OpenSkill (singles, doubles, free-for-all, convergencia, upsets, probabilidades).

## Estructura

```
domino-app/
├── supabase/
│   └── migrations/
│       └── 0001_init.sql       # Esquema completo (tablas, RLS, triggers, vistas)
├── scripts/
│   └── test-rating.ts          # Tests del motor de rating
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── page.tsx            # Landing + top 5
│   │   ├── login/              # Magic-link
│   │   ├── auth/
│   │   │   ├── callback/       # Intercambia code por session
│   │   │   └── signout/
│   │   ├── dashboard/          # Mis stats + últimas partidas
│   │   ├── leaderboard/        # Ranking global (singles/doubles)
│   │   ├── matches/
│   │   │   ├── new/            # Crear partida (server action)
│   │   │   └── [id]/           # Detalle de partida
│   │   └── profile/[username]/ # Perfil público
│   ├── components/
│   ├── lib/
│   │   ├── auth.ts             # helpers de sesión
│   │   ├── rating.ts           # Wrapper de OpenSkill
│   │   ├── matches.ts          # Server action: submitMatch
│   │   └── supabase/
│   │       ├── server.ts       # Cliente para server components
│   │       └── browser.ts      # Cliente para componentes 'use client'
│   └── middleware.ts           # Refresca sesión en cada request
├── next.config.mjs
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

## Deploy a Vercel

1. Sube el repo a GitHub.
2. En vercel.com → **Add New → Project**, importa el repo, selecciona la carpeta `domino-app/` como Root Directory.
3. En **Environment Variables** añade las mismas `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. En Supabase → **Authentication → URL Configuration** añade la URL de Vercel:
   `https://tu-app.vercel.app/auth/callback`
5. Deploy.

## Roadmap (v2+)

- Torneos (round-robin / brackets).
- Retos entre amigos / sistema social.
- Matchmaking: sugerir oponentes con rating similar usando `winProbability`.
- App nativa (Expo / React Native) consumiendo la misma DB Supabase.
- Tomar el flujo de marcador interactivo del `index.html` legacy (puntos por mano, capicúa +30, tranque) y reusarlo como pantalla "en vivo" antes de submitir el resultado final.

## Sobre el modelo

Ver [`docs/RATING.md`](./docs/RATING.md) para la explicación matemática del modelo OpenSkill, por qué es estrictamente superior a Elo para juegos por equipos, y cómo se interpreta cada número (μ, σ, ordinal).
