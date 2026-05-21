# DomiRank · User Stories como prompts para Claude Code

Estos prompts son copy-paste para sesiones de Claude Code. Cada uno arranca con el contexto del repo (Next.js 14 App Router + Supabase + OpenSkill), tiene un objetivo claro y criterios de aceptación. Asume que `domino-app/` es el root del proyecto.

---

## EPIC A · Autenticación y onboarding

### A1. Usuario edita su username durante onboarding

```
Estoy trabajando en DomiRank — un ranking de dominó con Next.js 14 (App Router) + Supabase + OpenSkill.
El onboarding actual (src/app/onboarding/) pide país y modalidad, pero el username se autogenera del email
en el trigger handle_new_user. Necesito agregar un tercer paso al onboarding donde el usuario pueda
elegir su username (con validación de unicidad y reglas: 3-24 caracteres, alfanumérico + _).

Tarea:
1. Agrega un paso 3 al OnboardingForm después de modality, antes del submit.
2. Server action checkUsernameAvailable(username) que consulta la tabla profiles.
3. Validación en vivo: muestra ✓ o ✗ a medida que el usuario escribe (debounce 300ms).
4. La server action saveOnboarding actualiza el username junto con country y default_modality.
5. Si el username está tomado, error legible.

Archivos a tocar:
- src/app/onboarding/OnboardingForm.tsx (agregar paso 3)
- src/app/onboarding/actions.ts (extender saveOnboarding + nueva action)

Acceptance:
- Usuario puede escribir un username y ver disponibilidad en tiempo real.
- No se permite submit con username inválido o tomado.
- El username se persiste correctamente en profiles.username.
```

### A2. Banner de "confirma tu correo" para usuarios no verificados

```
En DomiRank los usuarios pueden registrarse por email+password (Supabase requiere confirmación por email
antes de poder hacer ciertas acciones). Quiero un banner global persistente que aparezca en TODAS las
páginas autenticadas si el usuario no ha confirmado su correo, con un botón para reenviar el correo
de confirmación.

Tarea:
1. Crea componente <EmailConfirmBanner /> que lee user.email_confirmed_at de Supabase.
2. Si está null, renderiza un banner amarillo arriba del main con texto y botón "Reenviar correo".
3. Server action resendConfirmationEmail() que llama a supabase.auth.resend({ type: 'signup' }).
4. Integra el banner en src/components/AppShell.tsx encima del <main>.

Acceptance:
- Si email no confirmado, banner aparece en todas las páginas autenticadas.
- Botón "Reenviar" envía el correo y muestra confirmación visual (toast o cambio de texto).
- Cuando el usuario confirma, banner desaparece automáticamente (refrescar página es ok).
```

### A3. Pantalla "verificar tu cuenta" estilo chess.com

```
Después de signup con email+password, Supabase manda un correo de confirmación. Quiero una pantalla
dedicada (/verify-email) que se muestre después del signup con instrucciones claras: "Te enviamos un
correo a X. Click el enlace para activar tu cuenta." Con opción de reenviar correo y de cambiar de
correo si pusiste mal.

Tarea:
1. Nueva ruta src/app/verify-email/page.tsx.
2. Recibe el email vía query string (?email=...).
3. UI: ícono grande, instrucciones, botón reenviar, botón "usar otro correo" (vuelve a /signup).
4. Después del signup en SignupForm, redirige a /verify-email?email=X en vez de mostrar el banner inline.

Acceptance:
- Página clara y enfocada después del signup.
- Botón reenviar funciona con cooldown de 60 segundos.
- Usuario puede ir atrás a editar email sin perder el flujo.
```

---

## EPIC B · Perfil de jugador

### B1. Editor de foto con crop circular en /settings

```
Actualmente en /settings el upload de avatar sube el archivo tal cual al bucket avatars de Supabase
Storage. Quiero agregar un editor inline: cuando el usuario selecciona una imagen, abre un modal con
preview circular, zoom slider, y se puede arrastrar para centrar. Al confirmar, recortar la imagen al
área visible (256x256 px) y subirla.

Tarea:
1. Componente <AvatarCropper /> en src/components/AvatarCropper.tsx.
2. Usa <canvas> para recortar; opcional librería react-easy-crop si simplifica.
3. Output: data URL o blob de 256x256 PNG.
4. Modifica uploadAvatar en src/lib/settings.ts para aceptar el blob recortado.
5. Modal abre cuando el usuario selecciona archivo desde el input file.

Acceptance:
- Usuario ve preview circular en vivo mientras arrastra/zoomea.
- La imagen final es siempre 256x256 cuadrada (recortada a círculo en CSS).
- El archivo en Storage es ≤ 200KB.
```

### B2. Estadística "head-to-head" en perfil de amigo

```
Cuando un usuario abre /profile/[username] de un amigo con quien ha jugado, quiero mostrar una sección
"vs ti" con el balance: cuántas veces le ha ganado, cuántas ha perdido, último resultado, racha actual.
Solo aparece si los dos han jugado al menos 1 partida juntos.

Tarea:
1. Server action getHeadToHead(otherUserId) en src/lib/profile.ts (nuevo archivo).
2. Query SQL sobre match_players (JOIN matches): cuenta partidas donde ambos jugaron en equipos opuestos,
   con W/L del perspective del usuario actual.
3. Componente <HeadToHead /> que renderiza la card.
4. Integra en src/app/profile/[username]/page.tsx.

Acceptance:
- Si no han jugado juntos, la sección no aparece.
- Si sí, muestra G-P, % victoria, último resultado (fecha + score).
- Funciona tanto en singles como en doubles (cuenta cualquier partida donde ambos jueguen).
```

### B3. Gráfica de evolución de rating en perfil

```
Quiero una gráfica de línea en el perfil público que muestre la evolución del rating ordinal (μ-3σ)
de un jugador a lo largo del tiempo. Usar match_players.mu_after y .sigma_after por partida.

Tarea:
1. Server action getRatingHistory(userId, bucket, days) que devuelve [{date, ordinal}].
2. Componente <RatingChart /> usando Chart.js cargado por CDN.
3. Filtros: 15d / 30d / 90d / All (reuso del patrón de history).
4. Si el usuario tiene varios buckets activos, mostrar líneas separadas (color distinto por bucket).
5. Integra en /profile/[username] arriba del historial.

Acceptance:
- Gráfica se renderiza correctamente en mobile y desktop.
- Eje X = tiempo, eje Y = rating ordinal.
- Tooltip al hover mostrando partida específica.
- Chart.js cargado de cdnjs.cloudflare.com.
```

---

## EPIC C · Partidas en vivo

### C1. Botón "Tranque" en la pantalla en vivo

```
La pantalla /matches/[id]/live tiene botones Sumar / Capicúa / Deshacer. Falta el "Tranque" — cuando
nadie puede jugar más fichas y los equipos suman los puntos en mano. El equipo con menos pips gana la
mano y se lleva los pips del otro.

Tarea:
1. Botón "Tranque" en src/app/matches/[id]/live/LiveMatchScreen.tsx (al lado de Capicúa).
2. Click abre modal pidiendo: pips de Equipo A, pips de Equipo B.
3. Calcular ganador (menos pips), sumar pips del rival al ganador.
4. Crear match_round con kind='tranque', points = diferencia, team = ganador.
5. Si empate de pips, modal lo señala y permite resolver manualmente (forzar ganador).

Acceptance:
- Botón visible solo durante in_progress.
- Modal con inputs numéricos, validación 0-200.
- Round registrada en match_rounds con kind='tranque'.
- Lista de manos muestra "Tranque" como tipo de mano.
```

### C2. Mostrar probabilidad de victoria antes de iniciar partida

```
Después de elegir modalidad y jugadores en /matches/new pero antes de click "Iniciar", quiero mostrar
la probabilidad esperada de victoria de cada equipo según OpenSkill predictWin. Eso ayuda a calibrar
expectativas y muestra el valor del sistema de rating.

Tarea:
1. Calcular dinámicamente en el cliente cuando ambos equipos están llenos.
2. Componente <MatchPrediction /> que muestra barra horizontal A% vs B%.
3. Server action getRatingsForMatch(teamA, teamB, setSize, format) que devuelve μ/σ del bucket relevante.
4. Llama openskill.predictWin en el cliente con los ratings obtenidos.

Acceptance:
- Predicción visible solo cuando hay equipos completos según formato.
- Actualiza si el usuario cambia jugadores.
- "Favorito" se marca con un asterisco o badge.
```

### C3. Conectar el flujo "jugar partida" desde detalle de polla

```
En /tournaments/[id], si el usuario es el creador, ya hay un botón "+ Jugar partida" que lleva a
/matches/new?tournament=XXX. Sin embargo NewMatchForm no procesa el query string aún. Quiero que cuando
venga con ?tournament=XXX:
- Pre-llene la modalidad/set/target/capicúa de la polla (no editables).
- Limite los jugadores seleccionables a los inscritos en la polla.
- Al crear la partida, persista tournament_id correctamente.
- Después de finalizar, redirija de vuelta al detalle de la polla.

Tarea:
1. src/app/matches/new/page.tsx lee searchParams.tournament.
2. Si existe, fetch tournament + tournament_players y pásalos a NewMatchForm.
3. NewMatchForm acepta props tournamentMode con la config bloqueada.
4. live-match.ts startLiveMatch ya acepta tournament_id, verificar que llegue.
5. Después de finalizeMatch, redirect a /tournaments/[id] si tournament_id estaba.

Acceptance:
- Modalidad/puntos bloqueados visualmente cuando viene de polla.
- Solo aparecen jugadores inscritos en la búsqueda de equipos.
- Match queda asociado a la polla y aparece en sus standings.
```

---

## EPIC D · Pollas (torneos)

### D1. Compartir polla por link público

```
Las pollas públicas (visibility='public') aparecen en el listado de /tournaments para cualquier usuario
autenticado. Quiero que también se pueda compartir con un link público (sin requerir auth) — ideal
para mandar por WhatsApp y que vean standings desde fuera de la app.

Tarea:
1. Nueva ruta src/app/p/[id]/page.tsx (versión pública read-only).
2. RLS de tournaments ya permite SELECT en públicas — verificar que funciona sin auth.
3. Página muestra: nombre, modalidad, standings, partidas. Sin botones de acción.
4. Footer con "Crea tu propia polla en DomiRank" + CTA.
5. Botón "Compartir" en /tournaments/[id] copia el link /p/[id] al clipboard.

Acceptance:
- Link /p/[id] accesible sin login.
- Solo pollas con visibility='public' son accesibles.
- Polla privada en esta URL responde 404.
- Compartir genera link copiable con feedback visual.
```

### D2. Brackets eliminación directa como alternativa a rotación

```
Actualmente las pollas son siempre "rotación abierta" (4 jugadores random por partida). Quiero ofrecer
también modo "bracket eliminación directa" — 8/16/32 jugadores, partidas asignadas automáticamente,
ganador avanza. Útil para torneos reales.

Tarea:
1. Migration 0008 agrega columna format a tournaments: 'rotation' | 'single_elim'.
2. Si format='single_elim', generar tabla bracket: tournament_brackets(round, position, player1_id,
   player2_id, winner_id, match_id).
3. Server action generateBracket(tournamentId) sortea inscritos en el bracket inicial.
4. Cuando finaliza una partida del bracket, marcar ganador en bracket y crear la siguiente partida
   si hay rival listo.
5. Vista bracket gráfica en /tournaments/[id] (modo single_elim).

Acceptance:
- Al crear polla puedes elegir entre Rotación / Eliminación directa.
- Bracket inicial se genera al primer "Jugar partida".
- Visualización del bracket con líneas conectando partidas.
- Polla se cierra automáticamente al jugar la final.
```

---

## EPIC E · Social

### E1. Activity feed de amigos en la home

```
La página / actualmente muestra hero + top 5 + pollas activas. Quiero agregar un "Feed" con la
actividad reciente de mis amigos: "Carlos ganó contra Rafa (+1.2 μ) hace 2h", "Lucía empezó polla
Sabatina hace 1d", "Fernando subió 2 posiciones en el ranking esta semana".

Tarea:
1. Vista SQL friend_activity que combina: matches recientes de amigos, pollas creadas, hitos de rating.
2. Server action getFriendActivity(userId, limit) que retorna eventos ordenados por fecha desc.
3. Componente <ActivityFeed /> con items tipados (match, tournament_created, rating_milestone).
4. Solo se muestra a usuarios autenticados. Si no tiene amigos, CTA "Encuentra amigos".

Acceptance:
- Feed muestra últimos 20 eventos de amigos.
- Cada item linkea al recurso correspondiente (partida, polla, perfil).
- Auto-refresh cada 60s o al pull-to-refresh.
```

### E2. Pantalla "Notificaciones" con bell icon en header

```
Eventos que merecen notificar al usuario: friend request recibido, polla a la que te invitaron,
alguien que registró una partida donde tú jugaste, alguien aceptó tu friend request. Quiero un
sistema de notificaciones in-app.

Tarea:
1. Tabla notifications(id, user_id, type, payload jsonb, read_at, created_at) — migration 0009.
2. Trigger en friend_requests, matches, tournaments que inserta notification correspondiente.
3. Componente <NotificationBell /> en AppShell con contador de no-leídas.
4. Página /notifications con lista, marca leído al hacer click.
5. Server action markAllRead() y markRead(id).

Acceptance:
- Badge rojo en bell con #no-leídas.
- Click abre dropdown (desktop) o navega a /notifications (mobile).
- Click en notificación marca leído y va al recurso.
- Notificaciones de hace >30 días se borran automáticamente (limpieza nocturna).
```

### E3. Bloquear / reportar usuario

```
Cumplimiento mínimo de moderación: poder bloquear un usuario (deja de ver su perfil, no puede mandarme
solicitudes ni invitarme a pollas) y reportarlo (manda un mensaje al admin).

Tarea:
1. Tabla blocks(blocker_id, blocked_id) — migration.
2. Tabla reports(id, reporter_id, reported_id, reason, message, created_at, resolved_at).
3. Botón "..." en perfil ajeno con opciones "Bloquear" y "Reportar".
4. RLS updates: que blocks impida ver perfil bloqueado y impida friend_requests entre los dos.
5. Modal de reporte con razón (dropdown) + texto opcional.

Acceptance:
- Bloquear es bidireccional invisibilidad (ninguno ve al otro).
- Bloqueado no recibe notificación.
- Reportes quedan en la tabla para admin (sin UI de admin todavía).
```

---

## EPIC F · Rating avanzado

### F1. Sugerencia de oponentes con rating similar (matchmaking)

```
En /matches/new, después de elegir modalidad, quiero ofrecer una sección "Oponentes sugeridos" con
3-5 jugadores cuyo rating ordinal en ese formato esté en el rango ±3 del mío. Para fomentar partidas
parejas y aumentar el valor informativo del rating.

Tarea:
1. Server action getSuggestedOpponents(setSize, format, limit=5) que devuelve perfiles cercanos.
2. Excluye al usuario actual y a usuarios ya bloqueados.
3. Prioriza amigos del usuario sobre desconocidos.
4. Sección en NewMatchForm: chips con avatar+nombre+rating, click los agrega al Equipo B.

Acceptance:
- Solo aparece si el usuario tiene ≥5 partidas en ese formato (rating estable).
- Lista actualiza al cambiar set/format.
- Click en un sugerido lo agrega al equipo rival.
```

### F2. Hall of Fame y récords históricos

```
Página /records con datos curados: jugador con más partidas, mayor racha de victorias, biggest upset
(δμ más grande contra alguien mejor rankeado), polla más larga, etc. Para gamificar.

Tarea:
1. Server actions con queries SQL específicas para cada récord.
2. Página /records con cards por récord. Mobile-responsive.
3. Cada récord linkea al perfil/partida correspondiente.

Acceptance:
- Mínimo 6 récords distintos.
- Datos en vivo (calculados al cargar la página).
- Sección "Tu mejor récord" si el usuario aparece en alguno.
```

### F3. Country leaderboards

```
Además del ranking global de DomiRank, quiero leaderboards por país. Si yo soy de Venezuela, debe
haber un "Top 10 Venezuela" que solo cuenta jugadores con country='VE'. Es marketing puro pero da
sentido de comunidad local.

Tarea:
1. Tab adicional en /leaderboard?tab=country o página /leaderboard/[country].
2. Filtra por profiles.country = code.
3. Si el usuario está en ese país, su posición se destaca (highlight + scroll-to).
4. Banderas grandes en el header del leaderboard de país.

Acceptance:
- Banderas como tabs adicionales en leaderboard.
- Solo aparecen países con ≥3 jugadores rankeados.
- Tu propia bandera está pre-seleccionada cuando entras.
```

---

## EPIC G · PWA y mobile

### G1. PWA install prompt

```
DomiRank ya tiene manifest.webmanifest (public/manifest.webmanifest). Falta:
- Iconos PNG en 192x192 y 512x512 (currently solo declarados en manifest, sin archivos).
- Banner de "Instala DomiRank en tu teléfono" la primera vez que un usuario móvil visita la app.
- Service worker básico para que la app aparezca como instalable.

Tarea:
1. Generar iconos PNG con el logo "DR" en gradiente verde (programáticamente o con asset).
2. Guarda en public/icon-192.png y public/icon-512.png.
3. Service worker mínimo en public/sw.js + registro en src/app/layout.tsx.
4. Componente <InstallPrompt /> que detecta beforeinstallprompt event y muestra banner.
5. Botón "Instalar app" en /settings.

Acceptance:
- Chrome/Edge en Android muestran prompt de "Add to home screen".
- iOS Safari muestra ícono cuando se hace "Add to Home Screen" manual.
- App instalada abre en standalone (sin barra del navegador).
```

### G2. Push notifications via Web Push API

```
Quiero notificaciones push cuando: te invitan a una polla, alguien acepta tu friend request, una
partida en la que jugaste fue finalizada por el creador (con tu rating actualizado).

Tarea:
1. Pedir permission al usuario (componente <NotificationsOptIn /> en settings).
2. Generar VAPID keys, guardar en env vars.
3. Tabla push_subscriptions(user_id, endpoint, p256dh, auth, created_at).
4. Server action subscribeToPush(subscription) que guarda en DB.
5. Edge function o cron job que envía push cuando se crea notification en DB.
6. Service worker maneja push events y muestra notification.

Acceptance:
- Usuario puede activar push en /settings con un toggle.
- Llega notificación push real al móvil cuando un evento dispara.
- Click en notificación lleva al recurso correspondiente.
```

### G3. Offline mode para partida en vivo

```
La pantalla /matches/[id]/live escribe rounds al servidor en cada Sumar. Si pierdes conexión a mitad
de la partida, se rompe. Quiero que el live match funcione offline: las rondas se guardan en
IndexedDB y se sincronizan cuando vuelve la conexión.

Tarea:
1. IndexedDB store "pending_rounds" en el cliente.
2. addRound() escribe primero a IndexedDB, luego intenta server. Si falla, queda pendiente.
3. Background sync (Service Worker) o setInterval reintenta enviar pendientes.
4. Indicador visual de estado (online ✓ / offline ⚠️ con N pendientes).
5. Conflict resolution: si rounds llegan en orden distinto al esperado, normaliza por round_number.

Acceptance:
- Avión modo en mid-partida: puedo seguir sumando puntos.
- Al reconectarme, todas las rondas pendientes se envían correctamente.
- UI muestra que estás offline pero no bloquea uso.
```

---

## EPIC H · i18n y themes en producción

### H1. Sistema de i18n production-ready (ES/EN)

```
El preview tiene un toggle ES/EN funcionando. En Next.js production no lo tenemos. Implementar usando
next-intl o solución similar nativa.

Tarea:
1. Instala next-intl + sus dependencias.
2. Crea estructura locales/es.json y locales/en.json con todos los strings.
3. Middleware detecta locale del usuario (preferencia guardada en cookie o Accept-Language).
4. Componente <LangToggle /> en header con ES | EN.
5. Server components usan getTranslations(), client components useTranslations().
6. Reemplaza strings hardcoded por t('clave').

Acceptance:
- Toggle persiste preferencia en cookie.
- URLs no cambian (no /en/dashboard, /es/dashboard) — usa cookie.
- Todos los strings visibles están traducidos.
- Fallback a ES si la clave falta en EN.
```

### H2. Toggle de tema dark/light en producción

```
Igual al preview pero en Next.js: toggle de tema dark/light, persiste en cookie, server-side rendered
para evitar flash de tema incorrecto al cargar.

Tarea:
1. Cookie 'theme' con valor 'dark' | 'light'.
2. Layout.tsx lee la cookie en server side y aplica data-theme en el <html>.
3. Componente <ThemeToggle /> en AppShell que actualiza la cookie + DOM.
4. CSS variables con override [data-theme="light"] como en preview.
5. Script no-flash inline en <head> que aplica el tema antes del paint.

Acceptance:
- Cambio de tema instantáneo sin flash.
- Preferencia persiste entre sesiones.
- Tema correcto al primer render (server-side).
- Funciona en todas las páginas, incluidas las legales.
```

---

## EPIC I · Operaciones y compliance

### I1. Eliminación de cuenta (GDPR)

```
Por compliance, los usuarios deben poder eliminar su cuenta y todos sus datos asociados. Soft delete
con periodo de gracia de 30 días, después hard delete.

Tarea:
1. Migration: columna deleted_at en profiles.
2. Server action requestAccountDeletion() marca deleted_at = now() y signOut.
3. Cron job (Supabase edge function diaria) que hard-deletes profiles con deleted_at > 30 días.
4. Hard delete: profiles, auth.users, matches creadas por el user, friendships.
5. Las partidas donde participó (no creó) quedan anonimizadas (user_id → 'deleted-user-uuid').
6. Página /settings/delete con confirmación de doble paso (texto "BORRAR" + click).

Acceptance:
- Usuario puede iniciar deletion desde settings.
- Login en periodo de gracia restaura la cuenta (deleted_at = null).
- Después de 30 días, datos personales eliminados, historial anonimizado.
- Email opcional al usuario confirmando la eliminación.
```

### I2. Exportación de datos (GDPR Article 20)

```
Usuario debe poder exportar todos sus datos en formato JSON descargable.

Tarea:
1. Server action exportMyData() que retorna un blob JSON.
2. Incluye: profile, todas las matches donde participó (con snapshot de rating), pollas creadas/inscritas,
   friendships, friend_requests, avatar URL.
3. Endpoint /api/export que devuelve el JSON con header Content-Disposition.
4. Botón "Descargar mis datos" en /settings.

Acceptance:
- Click descarga archivo domirank-<username>-<date>.json.
- JSON contiene toda la información del usuario.
- No incluye datos de otros usuarios (solo refs anonimizadas).
```

### I3. Admin dashboard mínimo

```
Necesito una página /admin solo accesible a mi usuario (chequeo de email o user_id hardcoded por ahora)
para ver: signups recientes, reports pendientes, partidas marcadas como sospechosas, stats globales.

Tarea:
1. Constante en src/lib/admin.ts: ADMIN_USER_IDS = ['mi-uuid'].
2. Helper requireAdmin() en src/lib/auth.ts que valida o redirige.
3. Página src/app/admin/page.tsx con:
   - Tarjetas de KPIs (total users, total matches, matches last 7d, etc.).
   - Lista de reports pendientes con botón "Resolver".
   - Lista de últimos signups.
4. Acción resolveReport(id) que cierra el reporte.

Acceptance:
- /admin redirige a /dashboard si no eres admin.
- KPIs en vivo (sin caché agresiva).
- Reports resolubles desde la UI.
```

---

## Cómo usarlos

Para cada story:
1. Copia el bloque entero (incluyendo el contexto inicial).
2. Abre una sesión nueva de Claude Code en la raíz de `domino-app/`.
3. Pega y dale.
4. Claude Code va a explorar el código existente, planear, y construir.
5. Revisa el diff y comitea si te gusta.

Orden recomendado:
- **Primero (estabilizar):** A2, A3, I1 — compliance + UX de auth.
- **Después (engagement):** B2, E1, F1 — features que crean valor de uso recurrente.
- **Luego (escala):** G1, G2, H1, H2 — calidad mobile y i18n para crecer.
- **Avanzado (cuando ya hay tracción):** D2, E2, F2 — torneos serios, notificaciones, marketing.

Cada story es ~1-3 horas de Claude Code dependiendo de complejidad.
