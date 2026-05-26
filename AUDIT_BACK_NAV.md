# Audit Back Navigation — Sprint UX v2 US-01

## Root screens (bottom nav, NO AppHeader)
- [x] /dashboard — Inicio
- [x] /leaderboard — Ranking
- [x] /tournaments — Torneos (list)
- [x] /friends — Amigos
- [x] /matches/new — Jugar (center FAB in bottom nav)

## Secondary screens (AppHeader aplicado via SecondaryPageShell)
- [x] /profile/[username] — fallback /friends
- [x] /matches/[id] — fallback /dashboard
- [x] /tournaments/[id] — fallback /tournaments
- [x] /tournaments/[id]/manage — fallback /tournaments/[id] (dynamic)
- [x] /settings — fallback /settings (accessible from sidebar/avatar, not in bottom nav)
- [x] /notifications — fallback /dashboard

## Excluded (explicit — no AppHeader)
- /onboarding — flujo lineal; AppHeader sería signal incorrecto
- /login — auth flow
- /signup — auth flow
- /forgot-password — auth flow
- /reset-password — auth flow
- /auth/callback — auth flow
- /tournaments/new/step-* — wizard usa StepHeader propio
- /como-funciona — página informacional estática; accessible desde sidebar desktop, no requiere back nav

## Pages no detectadas / pendientes
- /admin/* — área de administración, sin auditar (fuera del scope del sprint UX v2)
- /terms — página estática pública, sin usuarios autenticados en mente
- /privacy — ídem
