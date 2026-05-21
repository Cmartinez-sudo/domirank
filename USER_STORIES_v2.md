# DomiRank · User Stories v2 (round de feedback de usuario)

Continuación de USER_STORIES.md. Cambios solicitados tras primera ronda de uso real.

---

## EPIC J · Rating visible siempre + cleanup visual

### J1. Rating visible en todas las pantallas

```
Contexto: DomiRank ya muestra el rating en /dashboard, /leaderboard y /profile, pero falta hacerlo
omnipresente. Cuando un usuario abre el menú de búsqueda, agrega un amigo a una partida, ve la lista
de amigos, mira el bottom nav, etc., quiero ver SIEMPRE el rating del usuario relevante junto a su nombre.

El rating display ya está normalizado 1-20 (función toDisplayRating en src/lib/rating.ts).

Tarea:
1. En src/components/AppShell.tsx, junto al avatar del usuario en el header móvil y sidebar desktop,
   muestra el DomiRank Global (formato pill: "DR 8.5" con color del tier).
2. En src/components/UserSearch.tsx, cada resultado debe incluir el rating al lado derecho
   (compacto: solo el número con 1 decimal).
3. En src/app/matches/new/NewMatchForm.tsx, cada jugador agregado a un equipo muestra su rating en
   el bucket relevante (singles_d6, doubles_d6, etc. según el formato del match).
4. En src/app/matches/[id]/live/LiveMatchScreen.tsx, debajo del nombre de cada jugador en los team
   tiles agrega "8.5" su rating actual (pre-partida).
5. En src/app/friends/FriendsPanel.tsx, cada UserRow incluye el rating del amigo.
6. En src/app/tournaments/[id]/page.tsx standings: junto al nombre, mostrar el rating del jugador.
7. Crea un componente reusable <RatingBadge user={...} bucket="global"|"d6_singles"|... compact />
   que renderiza pill con número + color del tier. Úsalo en todos los lugares.

El bucket por defecto en lugares ambiguos (search, friends, app shell) es 'global'.
En lugares específicos de un formato (live match, new match) usa el bucket relevante.

Acceptance:
- Apenas abro la app veo mi rating en el header.
- Al buscar usuarios para invitar, veo el rating de cada uno antes de elegir.
- En la partida en vivo, veo el rating de mis tres compañeros/rivales arriba del numpad.
- En la lista de amigos, cada amigo aparece con su rating al lado.
- El número y color del tier es consistente en todos los lugares (Aprendiz/Casual/Habilidoso/etc.).
```

### J2. Quitar banderitas de país del username en toda la UI

```
Contexto: actualmente muchas pantallas muestran "🇻🇪 Carlos M." con la bandera del país. El usuario
considera que es ruido visual y prefiere ver solo el nombre. El campo country sigue en la DB para
estadísticas, pero NO se renderiza en la UI junto al nombre.

Tarea:
1. Busca todas las ocurrencias en src/ donde se rendea una bandera (emoji o función countryFlag)
   junto al display_name o username.
2. Remueve la bandera de:
   - src/components/UserSearch.tsx (resultados de búsqueda)
   - src/app/leaderboard/page.tsx (filas del ranking)
   - src/app/friends/FriendsPanel.tsx (UserRow)
   - src/app/profile/[username]/page.tsx (header del perfil)
   - src/app/matches/new/NewMatchForm.tsx (team pickers)
   - Cualquier otro lugar que use COUNTRIES.find(...).flag delante del nombre

3. NO removas la bandera de:
   - La página /onboarding (paso 1 — es donde se selecciona país, ahí sí tiene sentido)
   - La página /settings sección "País y modalidad por defecto" (ahí está editando su país)
   - Algún futuro country leaderboard (si existe)

4. La función countryFlag() puede quedarse en src/lib/modalidades.ts pero deja de exportarse para
   estos casos.

Acceptance:
- En leaderboard, search, friends, profile, new match: aparece solo "Carlos M." y "@carlos", sin bandera.
- El campo country sigue funcionando en backend (no se borra).
- Onboarding sigue mostrando banderas en el selector de país.
```

---

## EPIC K · Restricción social: solo amigos pueden jugar

### K1. Bloquear creación de partidas con no-amigos

```
Contexto: actualmente cualquier usuario puede ser agregado a una partida buscándolo. El producto debe
restringir esto: SOLO puedes crear partidas con personas que son amigos aceptados tuyos. Esto fuerza
la creación de la red social y previene abuso (alguien podría inflar su rating jugando con cuentas
controladas).

Tarea:
1. Crea una nueva variante del componente UserSearch llamada <FriendSearch /> que solo devuelve amigos.
2. Server action searchFriends(q: string) en src/lib/users.ts: hace JOIN entre profiles y friendships
   filtrando por user_id = auth.uid().
3. En src/app/matches/new/NewMatchForm.tsx, reemplaza <UserSearch /> de los TeamPicker por <FriendSearch />.
   Placeholder: "Buscar entre tus amigos…".
4. Si el usuario no tiene amigos suficientes para el formato seleccionado (ej. doubles necesita al menos
   3 amigos para llenar los 4 slots con él incluido), muestra un empty state con CTA:
   "Necesitas amigos para jugar. Agrega amigos →" (lleva a /friends).
5. Validación server-side en src/lib/live-match.ts startLiveMatch: verifica que TODOS los
   team_a_players y team_b_players sean amigos del creador. Si no, devuelve error "Solo puedes jugar
   con tus amigos. Manda una solicitud primero a [@usuario]".
6. Mismo cambio en src/app/tournaments/new/NewTournamentForm.tsx: el creador solo puede agregar amigos
   al torneo (excepto a sí mismo, obvio).

Acceptance:
- Al crear partida, la búsqueda solo muestra mis amigos.
- Si intento llamar startLiveMatch con un no-amigo (vía API directo), el server lo rechaza.
- Empty state explica claramente qué hacer si no tengo amigos.
- En torneos, solo agrego amigos como participantes.
```

---

## EPIC L · Friend requests por correo

### L1. Email notification cuando recibes friend request

```
Contexto: actualmente sendFriendRequest crea la fila pendiente en friend_requests, pero el receptor
solo se entera al abrir la app y navegar a /friends. Queremos notificarle también por correo, con un
link directo a /friends donde puede aceptar/rechazar.

Stack disponible: Supabase + Resend (ya configurado como SMTP en Supabase Auth). Para envío
transaccional necesitamos invocar Resend API directamente (NO el SMTP de Supabase, que solo se usa
para magic links).

Tarea:
1. Crea cuenta en Resend y agrega RESEND_API_KEY a env vars (.env.example + Vercel + local).
2. Crea src/lib/email.ts con función sendTransactionalEmail({to, subject, html, text}).
   Usa fetch a https://api.resend.com/emails con Bearer auth.
3. Crea template <FriendRequestEmail from={...} appUrl={...} /> en src/emails/FriendRequest.tsx
   (HTML simple, mobile-friendly, con logo DR + botón "Ver solicitud" → app_url/friends).
4. Modifica sendFriendRequest en src/lib/friends.ts: tras crear la fila exitosamente, llama
   sendTransactionalEmail con el template, hacia el correo del receptor (fetch el email desde auth.users
   vía supabase admin client, o desde profiles si guardamos email — verificar).
5. Para acceptFriendRequest: enviar email "Tu solicitud fue aceptada" al sender original.
6. Manejar fallos de email sin romper la creación de la friend request (try/catch, log, continúa).
7. Si el usuario receptor tiene notificaciones email desactivadas (preferencia futura), respetarla.
   Por ahora todos reciben.

Migration (opcional pero recomendada):
- alter table profiles add column email_notifications boolean default true;
- Toggle en /settings para apagarlas.

Acceptance:
- Mando friend request → el receptor recibe email en ~30 segundos con asunto "@carlos quiere ser tu
  amigo en DomiRank".
- El correo tiene botón funcional "Ver solicitud" que lleva a /friends.
- Si el envío falla, la friend request se crea igual.
- Toggle "Recibir correos" en /settings funciona (si lo implementaste).
```

---

## EPIC M · Partida en vivo colaborativa

### M1. Live match visible en tiempo real para los 4 jugadores

```
Contexto: hoy la pantalla /matches/[id]/live solo funciona para el creador de la partida (el server
verifica match.created_by === user.id y redirige al detalle si eres otro). Queremos que los 4
jugadores vean la partida en vivo en sus móviles simultáneamente, con score que se actualiza al
instante cuando el "anotador" (creador) suma puntos.

Stack: Supabase Realtime para subscribirse a cambios en match_rounds.

Tarea:
1. Quita el guard "redirect si no eres creador" en src/app/matches/[id]/live/page.tsx. Cualquier
   match_player puede ver la pantalla.
2. En LiveMatchScreen.tsx, agrega un useEffect en cliente que se subscribe a:
   supabase.channel(`match-${matchId}`)
     .on('postgres_changes', { event: '*', schema: 'public', table: 'match_rounds', filter: `match_id=eq.${matchId}` }, ...)
     .on('postgres_changes', { event: '*', schema: 'public', table: 'matches', filter: `id=eq.${matchId}` }, ...)
     .subscribe()
3. Cuando llega un cambio, refetch los rounds y actualiza state. Usa router.refresh() o estado local.
4. Distingue UI según rol:
   - Creador (anotador): ve el numpad completo y puede sumar/deshacer/finalizar.
   - Otros jugadores (espectadores en su propia partida): ven los scores en tiempo real, lista de
     manos, pero no pueden modificar. En lugar del numpad, ven mensaje "@carlos está anotando".
5. Habilita Realtime en Supabase: dashboard → Database → Replication → marca tablas match_rounds y
   matches como "enabled" para que envíen eventos.

Acceptance:
- Carlos crea partida, los tres amigos abren la app — todos llegan automáticamente a la misma
  pantalla en vivo.
- Cuando Carlos da "Sumar 25", los otros tres ven el score actualizarse en menos de 1 segundo.
- Si un no-creador intenta navegar a la URL directa, ve la pantalla en modo espectador.
- Realtime no falla silenciosamente: si la subscripción se cae, hay reconnect automático.
```

### M2. Auto-redirect a partida activa al abrir la app

```
Contexto: si tengo una partida en vivo activa (yo estoy en ella, ya sea creando o como participante),
al abrir la app debe llevarme automáticamente a esa partida. No tiene sentido que vea el dashboard
mientras hay una partida esperando.

Tarea:
1. En src/lib/auth.ts, agrega helper getActiveMatchForUser(userId): consulta matches donde
   status='in_progress' y existe match_players con user_id = userId. Devuelve el primero (debe ser
   único — ya hay unique index parcial sobre created_by, pero como participante puede haber otra).
2. En src/components/AppShell.tsx (server component que ya carga user + profile), también carga
   activeMatch. Si existe, renderiza un banner sticky arriba: "⚡ Tienes una partida en curso —
   [Volver a la partida]" en color primary, prominente.
3. (Opcional, más agresivo) En todas las rutas autenticadas EXCEPTO /matches/[id]/live, redirige
   automáticamente a la partida activa la primera vez que el usuario navega. Usa cookie/sessionStorage
   para evitar bucle infinito (no redirigir si el usuario lo cerró manualmente).
4. Misma lógica para torneos en progreso: si hay una partida del torneo activa donde participo,
   prompt o redirigir.

Acceptance:
- Abro la app y tengo partida activa → banner verde arriba en todas las pantallas con link directo.
- (Opcional) Refresh de la app me lleva a la partida directamente.
- Cerrar el banner persiste para esa sesión (no vuelve a aparecer hasta abrir/cerrar app).
```

### M3. Restricción: una partida activa a la vez por usuario

```
Contexto: ya hay un unique index parcial sobre matches.created_by where status='in_progress' que
impide a UN usuario crear DOS partidas simultáneas como creador. Pero un usuario podría estar PARTICIPANDO
en una partida (como invitado por amigo) Y crear otra simultáneamente. Hay que bloquear eso también.

Tarea:
1. En src/lib/live-match.ts startLiveMatch: antes de crear el match, valida que NINGUNO de los 4
   jugadores (team_a + team_b) esté actualmente en otra partida in_progress. Query:
     select user_id from match_players mp
     join matches m on m.id = mp.match_id
     where m.status='in_progress' and mp.user_id = any(...)
2. Si alguien está en otra partida activa, devuelve error específico:
   "@usuario_X ya está en otra partida. Espera a que termine."
3. UI: cuando el usuario intenta agregar un amigo al equipo, si ese amigo está en partida activa,
   muestra badge "🔴 en partida" junto a su nombre y deshabilita el botón de agregar.
4. Server action getActivePlayerIds(): devuelve set de user_ids actualmente en partida activa. Se usa
   en NewMatchForm para marcar visualmente.

Acceptance:
- Intento crear partida con un amigo que ya está jugando → error claro con el nombre del amigo bloqueando.
- En el selector de equipo, los amigos en partida activa aparecen marcados visualmente.
- No es posible (vía cliente o API directa) crear partidas simultáneas con jugadores duplicados.
```

---

## EPIC N · Validación de score por consenso

### N1. Aprobación de 3 de 4 jugadores para finalizar partida

```
Contexto: hoy, cuando el creador finaliza una partida, se aplica OpenSkill inmediatamente y el rating
de los 4 se actualiza. Pero ¿qué pasa si el creador anotó mal o quiere inflar el rating de sus
compañeros? Necesitamos consenso: al finalizar, la partida queda en estado "pending_confirmation",
y al menos 3 de los 4 jugadores deben confirmar el resultado antes de aplicar el rating.

Tarea:
1. Migration 0010 — pending_confirmation:
   alter table matches
     add column if not exists confirmations jsonb default '[]'::jsonb,
     add column if not exists confirmation_deadline timestamptz;
   -- 'pending_confirmation' es nuevo valor permitido en status:
   alter table matches drop constraint matches_status_check;
   alter table matches add constraint matches_status_check check (
     status in ('in_progress','pending_confirmation','completed','cancelled','disputed')
   );

2. En src/lib/live-match.ts finalizeMatch: NO aplica OpenSkill todavía. En su lugar:
   - status='pending_confirmation'
   - confirmation_deadline = now() + interval '24 hours'
   - confirmations = [{user_id: creator, confirmed_at: now()}] (el creador implícitamente confirma al
     darle "finalizar").
   - Notifica a los otros 3 (in-app + email opcional vía Epic L).

3. Nueva server action confirmMatch(matchId): si auth.uid() está en match_players de ese match,
   añade {user_id, confirmed_at: now()} al jsonb. Si llegamos a >=3 confirmaciones, aplicar OpenSkill
   y marcar 'completed'. Mover la lógica actual de finalizeMatch (que recalcula ratings) a una
   función interna applyRatings(matchId) que se llama cuando hay 3 confirmaciones.

4. Nueva server action disputeMatch(matchId, reason): permite a un participante reportar disputa.
   Marca status='disputed', notifica al creador. Creador puede editar manos y re-iniciar el flujo
   de confirmación.

5. UI en src/app/matches/[id]/page.tsx (detalle):
   - Si status='pending_confirmation': muestra checklist visible "Esperando confirmación" con avatars
     de cada participante y su estado (✓ confirmado / ⏳ pendiente).
   - Botones "Confirmar" y "Disputar" si soy un match_player que aún no confirmó.
   - Banner con countdown del deadline (24h).
   - Si pasan 24h sin las 3 confirmaciones, status='cancelled' automáticamente (cron job o lazy check).

6. UI en src/app/matches/[id]/live/LiveMatchScreen.tsx: cuando el creador da "Finalizar", en vez de
   redirigir al detalle con rating ya aplicado, redirige al detalle con la pantalla de "Esperando
   confirmaciones".

7. Notificación in-app + email: "Confirma el resultado de tu partida con @carlos, @rafa y @lucia".

Acceptance:
- Creador da "Finalizar" → status pasa a pending_confirmation, NO se aplican ratings todavía.
- Los otros 3 jugadores reciben notificación in-app + email.
- Cada uno puede confirmar o disputar desde el detalle de la partida.
- Cuando llegan a 3 confirmaciones (incluyendo el creador), OpenSkill se aplica y status=completed.
- Si solo 2 confirman en 24h, partida se cancela automáticamente sin afectar ratings.
- Si alguien disputa, el creador puede editar y reintentar.
```

### N2. Historial muestra estado de confirmación

```
Contexto: en /dashboard y /profile, el historial de partidas muestra G/P y delta de rating. Con
pending_confirmation, hay que añadir badge claro de estado.

Tarea:
1. En src/app/dashboard/page.tsx y src/app/profile/[username]/page.tsx, donde se renderiza cada
   partida del historial, agrega badge:
   - 'completed': sin badge (estado normal)
   - 'pending_confirmation': badge amarillo "⏳ Esperando confirmaciones (2/3)"
   - 'disputed': badge rojo "⚠️ En disputa"
   - 'cancelled': badge gris "Cancelada"
2. Para partidas pending donde yo debo confirmar, badge clickeable que lleva al detalle.

Acceptance:
- Veo mis partidas pendientes claramente diferenciadas de las completadas.
- Tap en una pendiente me lleva directo al detalle donde puedo confirmar.
```

---

## Orden de ejecución sugerido

1. **J2 (banderitas off)** — 30 min, cleanup visual.
2. **J1 (rating siempre visible)** — 2-3h, mejora masiva en UX.
3. **K1 (solo amigos)** — 1-2h, foundation antes del live colaborativo.
4. **L1 (email friend requests)** — 2-3h, primer email transaccional.
5. **M3 (una partida a la vez)** — 1h, validación previa.
6. **M1 + M2 (live colaborativo + auto-redirect)** — 3-4h, biggest UX win.
7. **N1 + N2 (consenso de score)** — 4-5h, integridad del rating.

Stories importantes para hacer en bloque (porque comparten infraestructura):
- L1 + N1 ambos requieren email transaccional vía Resend. Hazlas en una sesión.
- M1 + M2 + M3 forman una unidad coherente (live colaborativo). Hazlas en una sesión.

## Notas técnicas globales

- Para Supabase Realtime asegúrate de habilitarlo en el dashboard (Database → Replication → publication).
- Para emails transaccionales con Resend, necesitas verificar tu dominio o usar onboarding@resend.dev
  (solo permite enviar a ti mismo). Si aún no tienes dominio, puedes verificar single sender (email
  personal).
- Las RLS policies que tienes actualmente en match_rounds (solo creador puede leer) deben relajarse
  para que match_players también lean — verifica antes de implementar M1.
