# Guía de despliegue · DomiRank

Esta guía te lleva de cero a una app desplegada en Vercel + Supabase, con tu propio subdominio `*.vercel.app`. Tiempo estimado: 30-45 minutos la primera vez.

## Pre-requisitos

- Cuentas activas en [Vercel](https://vercel.com) y [Supabase](https://supabase.com).
- [Node.js 20+](https://nodejs.org) instalado localmente.
- Git y una cuenta de GitHub.
- Cuenta de correo de Resend, SendGrid o similar (Supabase trae uno de prueba que basta para empezar).

---

## 1. Inicializar repo y subir a GitHub

Desde tu terminal en `/Users/carlosmartinez/Documents/Claude/Projects/Domino`:

```bash
cd /Users/carlosmartinez/Documents/Claude/Projects/Domino
git init -b main
echo "node_modules
.next
.env
.env.local
.DS_Store
.vercel" > .gitignore
git add .
git commit -m "DomiRank · initial commit"
```

Crea un repo nuevo en GitHub (privado o público, como prefieras) — llámalo `domirank`. GitHub te muestra el remote URL. Lo conectas:

```bash
git remote add origin git@github.com:TU_USUARIO/domirank.git
git push -u origin main
```

Listo, tu código vive en GitHub.

## 2. Crear el proyecto en Supabase

1. Ve a https://supabase.com/dashboard → **New project**.
2. Nombre: `domirank` (o lo que prefieras).
3. Contraseña de Postgres: guárdala bien, la vas a necesitar.
4. Región: elige la más cercana a tus usuarios (ej. **South America (São Paulo)** para Venezuela/RD/Caribe).
5. Plan: **Free** está bien para empezar.
6. Espera ~2 minutos a que termine de provisionar.

### Ejecutar las migraciones

En el dashboard de Supabase, abre **SQL Editor → New query**. Vas a pegar y ejecutar cada migración en orden, una a la vez:

1. `domino-app/supabase/migrations/0001_init.sql` — esquema base
2. `domino-app/supabase/migrations/0002_tournaments_avatars.sql` — pollas y storage
3. `domino-app/supabase/migrations/0003_domirank_global.sql` — DomiRank global
4. `domino-app/supabase/migrations/0004_modalities_onboarding.sql` — modalidades
5. `domino-app/supabase/migrations/0005_live_match.sql` — partida en vivo
6. `domino-app/supabase/migrations/0006_friends_visibility.sql` — amigos y privacidad

Si todo va bien, no verás errores. Si una falla porque ya existe algo, revisa el error y aplica solo los `add column if not exists`.

### Crear el bucket de avatares

**Storage → New bucket** → nombre `avatars` → **Public bucket** ✓ → Save. Las políticas de RLS ya las creó la migración 0002.

### Configurar Auth

**Authentication → URL Configuration** →
- **Site URL**: por ahora `http://localhost:3000` (lo cambiamos a la URL de Vercel después).
- **Redirect URLs**: añade `http://localhost:3000/auth/callback` (y después la de Vercel).

**Authentication → Email Templates** → personaliza el "Magic Link" si quieres (subject "Entra a DomiRank", etc.).

### Copiar las claves

**Project Settings → API**:
- `URL` (https://xxxxxxx.supabase.co)
- `anon` `public` key

Las usarás como variables de entorno.

## 3. Probar local antes de desplegar

```bash
cd domino-app
npm install
cp .env.example .env.local
# Edita .env.local con tus valores de Supabase
npm run dev
```

Abre http://localhost:3000. Crea una cuenta con magic link, completa onboarding, prueba una partida. Si todo funciona, listo para desplegar.

## 4. Desplegar a Vercel

1. Ve a https://vercel.com/new
2. **Import Git Repository** → selecciona `domirank`.
3. **Root Directory** → `domino-app/` (importante, no la raíz del repo).
4. **Framework Preset** → Next.js (debería detectarlo solo).
5. **Environment Variables** → añade:
   - `NEXT_PUBLIC_SUPABASE_URL` = tu URL de Supabase
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = tu anon key
6. **Deploy** → espera ~2 minutos.

Cuando termine, te da una URL tipo `domirank-xxxx.vercel.app`. Ese es tu primer deploy.

## 5. Actualizar URLs de auth en Supabase

Vuelve a Supabase **Authentication → URL Configuration**:
- **Site URL**: `https://domirank-xxxx.vercel.app`
- **Redirect URLs**: añade `https://domirank-xxxx.vercel.app/auth/callback`

Si no haces esto, los magic links no funcionan en producción.

## 6. Verificación final

Abre tu URL de Vercel:
1. Click "Entrar" → escribe tu correo.
2. Revisa tu inbox, abre el magic link.
3. Te redirige a `/onboarding` → elige país y modalidad.
4. Llegas al dashboard.
5. Click "+" → crea una partida, busca a un amigo (puedes registrar a otro correo en otra pestaña para probar).
6. Juega la partida en vivo, finaliza, ve tu DomiRank actualizarse.

Si todo eso funciona, **ya está desplegado y usable por el mundo**.

## 7. (Opcional) Dominio custom

Cuando estés listo:
1. Compra `domirank.com` (o `.app`, `.gg`) en Namecheap, Cloudflare o donde quieras.
2. En Vercel: **Settings → Domains → Add** → escribe el dominio.
3. Vercel te da los registros DNS a configurar (CNAME o A).
4. Espera la propagación (~5-30 min).
5. Vuelve a actualizar URLs en Supabase.

## Resolución de problemas comunes

**"Email rate limit exceeded"** al probar magic links demasiado seguido: Supabase free tier limita a ~3-4 correos por hora por dirección. Espera o usa otra cuenta.

**"Database error saving new user"**: la migración 0001 no se aplicó bien, falta el trigger `on_auth_user_created`. Revisa que la migración haya creado la función `public.handle_new_user`.

**Avatares no aparecen tras subir**: revisa que el bucket `avatars` sea público y que las policies estén creadas (migración 0002).

**El onboarding no redirige correctamente**: verifica que `auth.callback` esté en redirect URLs de Supabase y que el trigger esté creando profiles con `onboarded=false`.

## Siguientes pasos

Una vez desplegado:
- Invita a tu grupo de WhatsApp/Telegram al subdominio Vercel.
- Recoge feedback de los primeros usuarios.
- En v1.1 podemos añadir: notificaciones, push para amigos, themes/i18n en producción, exportar historial, integrar con calendarios para pollas recurrentes.
