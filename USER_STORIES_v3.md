# DomiRank · User Stories v3 — Flujo social in-app

Épica social completa: perfiles públicos navegables con acción "Agregar amigo" smart-state, sistema de notificaciones in-app con badge en tiempo real, y restricción de "solo amigos pueden jugar". Cada story es shippeable independiente pero juntas componen el flujo end-to-end.

---

## EPIC O · Social in-app: amigos sin fricción de correo

**Visión del producto:**

Hoy mandar una friend request requiere ir a `/friends`, buscar al usuario por nombre, mandarle la solicitud. El receptor solo se entera al abrir `/friends`. Es un flujo serio pero seco — falta la inmediatez de "estoy mirando el perfil de Carlos, le doy un click y listo". Y al receptor no le llega nada visible si está usando la app — debe saber que tiene que ir a friends.

El flujo objetivo:

1. Entro al perfil público de Carlos (le hago tap a su nombre en cualquier lugar).
2. Veo su rating, sus partidas, sus modalidades. Hay un botón claro "Agregar amigo" arriba.
3. Tap → la solicitud sale al instante, el botón cambia a "Solicitud enviada · Cancelar" con animación.
4. Carlos, que está usando la app en otro teléfono, ve aparecer un badge rojo en su campana de notificaciones (sin refresh, en tiempo real).
5. Carlos abre el dropdown de notificaciones, ve "Rafa quiere ser tu amigo" con avatar + dos botones "Aceptar" / "Rechazar".
6. Tap Aceptar → notificación se marca leída, ambos quedan como amigos, y en MI lado el botón del perfil de Carlos cambia a "Amigos ✓".
7. Inmediatamente puedo crear una partida y agregar a Carlos como rival/compañero (antes no aparecía en la búsqueda).

Cero correo, cero refresh, cero fricción. Es como Instagram pero para dominó.

---

### O1. FriendActionButton: botón inteligente en perfiles públicos

```
Contexto: DomiRank tiene perfiles públicos en /profile/[username] que muestran avatar, rating,
historial y modalidades. Falta una acción clara para iniciar/gestionar la relación de amistad
desde el perfil mismo, sin tener que ir a /friends.

Ya existe getRelationStatus(otherUserId) en src/lib/friends.ts que devuelve un discriminated
union { kind: 'self' | 'friends' | 'outgoing_pending' | 'incoming_pending' | 'none' }. Las server
actions sendFriendRequest, acceptFriendRequest, rejectFriendRequest, cancelFriendRequest, unfriend
también están listas.

Tarea: crear componente <FriendActionButton /> que renderiza distinto según el estado y persistir
el cambio con optimistic UI.

1. Nuevo componente src/components/FriendActionButton.tsx ('use client'):

   - Props: { targetUserId: string, initialStatus: RelationStatus, targetUsername: string }
   - Maneja estado interno (status: RelationStatus, pending: boolean).
   - Renderiza según status.kind:

     * 'self': no renderizar nada (es tu propio perfil).

     * 'none': botón primary grande "Agregar amigo" con icono ti-user-plus a la izquierda.
       onClick → optimistic: pasa a 'outgoing_pending' instantáneo. Llama sendFriendRequest.
       Si error → revierte estado + toast con error.
       Si ok → router.refresh() para actualizar contadores.

     * 'outgoing_pending': botón ghost "Solicitud enviada" con icono ti-clock + sub-acción
       pequeña "Cancelar" en color text-mute. Click en la sub-acción → cancelFriendRequest.
       Optimistic: pasa a 'none'.

     * 'incoming_pending': renderiza DOS botones lado a lado:
       - Primary verde grande "Aceptar" → acceptFriendRequest → optimistic 'friends'.
       - Ghost text-muted "Rechazar" → rejectFriendRequest → optimistic 'none'.
       Encima un texto pequeño "@username quiere ser tu amigo" con avatar pequeño.

     * 'friends': botón ghost con check verde "Amigos" + icono ti-user-check. Click abre
       dropdown/bottom sheet (en mobile) con opción "Quitar de amigos" en text-danger.
       Confirma con modal/sheet antes de ejecutar unfriend.

2. Integrar en src/app/profile/[username]/page.tsx:

   - Server side: llamar a getRelationStatus(profile.id) y pasar el resultado como initialStatus.
   - Render: arriba del bloque de rating, dentro del header del perfil, render
     <FriendActionButton ...> ocupando ancho completo en mobile, alineado a la derecha del header
     en desktop.

3. Loading states:
   - Mientras pending=true, deshabilitar el botón pero mantener el texto visible con un spinner
     a la derecha.
   - Animar transiciones de estado con framer-motion (fade-in del nuevo estado, 200ms).

4. Toasts:
   - Después de cada acción exitosa, mostrar toast pequeño abajo: "Solicitud enviada a @rafa" /
     "Ahora son amigos" / "Solicitud rechazada" / "Solicitud cancelada" / "Ya no son amigos".
   - Usa el componente <Toast /> si existe; si no, crea uno simple con framer-motion
     (slide-up + fade, autodismiss en 3s).

5. Accesibilidad:
   - Botones con aria-label cuando solo tienen ícono.
   - Dropdown/sheet con role="dialog" y focus trap.
   - Confirmación de "Quitar amigo" con confirmación clara (no doble tap, modal explícito).

Archivos a tocar:
- src/components/FriendActionButton.tsx (nuevo)
- src/components/Toast.tsx (nuevo si no existe)
- src/app/profile/[username]/page.tsx (integrar)

Acceptance:
- En el perfil de un desconocido veo "Agregar amigo" prominente.
- Tap → cambia a "Solicitud enviada" instantáneamente, sin lag perceptible.
- Si el otro usuario me había mandado solicitud antes, veo "Aceptar/Rechazar" en lugar de
  "Agregar amigo".
- Si ya somos amigos, veo "Amigos ✓" y puedo quitarlo desde un dropdown con confirmación.
- Toast confirma cada acción.
- Si la server action falla (network error), revierte estado y muestra toast rojo con el error.
```

---

### O2. Sistema de notificaciones in-app con bell en tiempo real

```
Contexto: cuando alguien manda una friend request, el receptor solo se entera al abrir /friends.
Queremos un sistema de notificaciones in-app que:
- Muestre un bell icon en el AppShell (tanto en mobile bottom nav como en desktop sidebar/header).
- Muestre un badge rojo con contador de no-leídas.
- Al click, abre un dropdown (desktop) o navega a /notifications (mobile).
- Se actualice en TIEMPO REAL: cuando llega una notificación nueva, el badge cambia sin refresh.
- Cada notificación lleva al recurso correspondiente (perfil, partida, polla).

Tipos de notificaciones a soportar inicialmente:
- friend_request_received
- friend_request_accepted
- (futuro: match_invitation, match_finalized, tournament_invitation, etc.)

Tarea:

1. Migration 0010_notifications.sql:

   create table public.notifications (
     id uuid primary key default gen_random_uuid(),
     user_id uuid not null references auth.users(id) on delete cascade,
     type text not null,
     payload jsonb not null default '{}'::jsonb,
     read_at timestamptz,
     created_at timestamptz not null default now()
   );
   create index on public.notifications (user_id, read_at, created_at desc);

   alter table public.notifications enable row level security;
   create policy notifications_read_own on public.notifications for select using (auth.uid() = user_id);
   create policy notifications_update_own on public.notifications for update using (auth.uid() = user_id);

   -- Trigger para insertar notificación al recibir friend request:
   create or replace function public.on_friend_request_created()
   returns trigger language plpgsql security definer as $$
   begin
     insert into public.notifications (user_id, type, payload)
     values (new.to_user, 'friend_request_received', jsonb_build_object(
       'request_id', new.id,
       'from_user', new.from_user
     ));
     return new;
   end;
   $$;
   create trigger friend_requests_after_insert
     after insert on public.friend_requests
     for each row execute function public.on_friend_request_created();

   -- Trigger cuando se acepta:
   create or replace function public.on_friend_request_accepted()
   returns trigger language plpgsql security definer as $$
   begin
     if new.status = 'accepted' and old.status = 'pending' then
       insert into public.notifications (user_id, type, payload)
       values (new.from_user, 'friend_request_accepted', jsonb_build_object(
         'request_id', new.id,
         'by_user', new.to_user
       ));
     end if;
     return new;
   end;
   $$;
   create trigger friend_requests_after_update
     after update on public.friend_requests
     for each row execute function public.on_friend_request_accepted();

2. Habilitar Realtime en Supabase dashboard:
   - Database → Replication → enable la tabla 'notifications' en la publication 'supabase_realtime'.

3. Server actions en src/lib/notifications.ts:

   - getUnreadCount(): retorna count de notifications donde user_id = me y read_at is null.
   - getNotifications(limit = 50): lista las últimas N con join al perfil del actor cuando aplique.
   - markRead(notificationId): actualiza read_at = now().
   - markAllRead(): bulk update.

4. Componente <NotificationBell /> en src/components/NotificationBell.tsx ('use client'):

   - Props: { initialUnreadCount: number, userId: string }
   - useEffect que se subscribe a Supabase Realtime:
       supabase.channel(`notifications-${userId}`)
         .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications',
             filter: `user_id=eq.${userId}` },
           () => setUnreadCount(c => c + 1))
         .subscribe()
   - Render:
       <button className="relative">
         <i className="ti ti-bell" />
         {unreadCount > 0 && (
           <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-danger
                            text-white text-xs flex items-center justify-center px-1 font-medium">
             {unreadCount > 99 ? '99+' : unreadCount}
           </span>
         )}
       </button>
   - Click → en mobile (< md) navega a /notifications, en desktop abre dropdown inline.
   - El dropdown muestra las últimas 10 con preview, link "Ver todas" abajo.
   - Animación bounce en el bell cuando llega notif nueva (framer-motion key={unreadCount}).

5. Integrar <NotificationBell /> en src/components/AppShell.tsx:
   - Server side: leer unreadCount con getUnreadCount() y pasarlo como initialUnreadCount.
   - En desktop sidebar: arriba a la derecha del header.
   - En mobile bottom nav: NO ponerlo ahí (mantenemos los 5 items de nav). En su lugar, en el
     header mobile (junto al avatar arriba a la derecha) renderizar el bell.

6. Página /notifications/page.tsx:
   - Server component que carga las últimas 50 notifications con join al perfil del actor.
   - Lista vertical con avatar + texto + timestamp + acción inline donde aplique:
     • friend_request_received: muestra avatar+nombre del que mandó, botones "Aceptar"/"Rechazar"
       inline (sin tener que entrar al perfil).
     • friend_request_accepted: avatar+nombre del que aceptó, link "Ver perfil".
   - Al cargar la página, marca como leídas automáticamente (markAllRead).
   - Empty state: ícono ti-bell-off + "No tienes notificaciones aún" + sub "Cuando alguien
     interactúe contigo, lo verás aquí".

7. Texto de las notificaciones (i18n-ready, hardcoded en español por ahora):
   - friend_request_received: "<strong>@{from_username}</strong> quiere ser tu amigo"
   - friend_request_accepted: "<strong>@{by_username}</strong> aceptó tu solicitud"

8. Diseño:
   - Cada notification card: avatar 36px izquierda, texto centro (ellipsis si largo), timestamp
     a la derecha (formato relativo: "hace 5 min", "hace 2 h", "ayer").
   - No leídas: background sutil bg-primary/5, indicador punto verde a la izquierda del avatar.
   - Leídas: background normal, sin indicador.
   - Hover: bg-surface-2.
   - Click en la card (no en botones de acción) → marca leída + navega al recurso.

Archivos a tocar:
- supabase/migrations/0010_notifications.sql (nuevo)
- src/lib/notifications.ts (nuevo)
- src/components/NotificationBell.tsx (nuevo)
- src/components/AppShell.tsx (integrar bell)
- src/app/notifications/page.tsx (nuevo)

Acceptance:
- Veo un bell en el header (desktop sidebar o mobile top right). Si tengo notificaciones no
  leídas, aparece badge rojo con número.
- Cuando alguien me manda friend request, el badge aumenta en < 2 segundos sin refresh.
- Click en bell desktop → dropdown con últimas 10. Click mobile → /notifications.
- En /notifications puedo aceptar/rechazar friend requests inline.
- Al entrar a la página, todas las notificaciones se marcan leídas (badge cae a 0).
- Empty state apropiado si no tengo notificaciones.
```

---

### O3. Restricción "solo amigos pueden jugar" + onboarding visual

```
Contexto: la story K1 (USER_STORIES_v2.md) describía el comportamiento de bloquear partidas con
no-amigos. Hay que asegurar que está implementado y darle un mejor UX cuando un usuario nuevo
intenta crear partida sin tener amigos suficientes.

Tarea:

1. Verificar y completar el cambio de UserSearch → FriendSearch en src/app/matches/new/NewMatchForm.tsx:
   - El TeamPicker usa <FriendSearch /> en lugar de <UserSearch />.
   - El componente FriendSearch llama a searchFriends(q) en lugar de searchUsers(q).
   - server action searchFriends(q): JOIN profiles + friendships filtrado por user_id = me.

2. Validación server-side en startLiveMatch:
   - Antes de crear el match, verificar que TODOS los user_ids de teamA + teamB sean amigos del
     creador (excepto el propio creador). Query:
       select count(*) from public.friendships
       where user_id = me and friend_id in (...)
   - Si count < expected, devolver error: "Solo puedes jugar con amigos. Manda solicitud a
     @username primero." (lista los faltantes específicamente).

3. Aplicar mismo bloqueo en src/lib/tournaments.ts createTournament: solo amigos pueden ser
   participantes.

4. Empty state en NewMatchForm cuando NO tienes amigos:
   - Si el usuario tiene 0 amigos al cargar el form, no mostrar los TeamPickers. En su lugar:
     - Ilustración grande (ti-users-off al 64px) o gráfico SVG ilustrativo.
     - Título: "Necesitas amigos para jugar"
     - Sub: "Búscalos por su usuario y mándales una solicitud. Cuando acepten, podrán jugar
       partidas juntos y aparecer en tu rating."
     - Dos CTAs:
       • Primary: "Buscar amigos →" → /friends.
       • Secondary: "Invitar por WhatsApp" → genera link share con texto "Estoy en DomiRank,
         búscame como @miusuario para jugar: https://domirank.app".
   - Si tienes 1-2 amigos pero el formato requiere más (ej. 2v2 y solo tienes 1 amigo), mismo
     pattern pero más sutil: muestra los TeamPickers pero con un banner amarillo arriba:
     "Te faltan {n} amigos más para llenar el equipo. Agrega más amigos."

5. Indicador "en partida" en FriendSearch:
   - Al renderizar resultados de búsqueda de amigos, si un amigo está actualmente en otra partida
     in_progress, mostrar badge "🔴 en partida" junto al nombre y deshabilitar tap para
     agregarlo.
   - Query a hacer una sola vez al renderizar: getActivePlayerIds() devuelve set de user_ids
     actualmente en match.status = 'in_progress'. Marcar visualmente en los resultados.

6. Mejora UX en el flujo end-to-end:
   - Después de aceptar una friend request en /notifications, redirigir con prompt:
     "¡Ya son amigos! ¿Quieres crear una partida con @username?" → botón directo a /matches/new
     con el amigo preseleccionado en team B.

Archivos a tocar:
- src/lib/users.ts (agregar searchFriends si no existe; agregar getActivePlayerIds)
- src/components/FriendSearch.tsx (nuevo o variante de UserSearch)
- src/app/matches/new/NewMatchForm.tsx (empty state + usar FriendSearch + indicador en partida)
- src/lib/live-match.ts (validación server-side de amistad)
- src/lib/tournaments.ts (misma validación para torneos)
- src/app/notifications/page.tsx (prompt post-aceptar)

Acceptance:
- Si entro a /matches/new sin amigos, veo un empty state amigable con CTA para encontrar amigos.
- Si tengo amigos suficientes, la búsqueda solo retorna amigos.
- Si intento (vía API) crear partida con un no-amigo, el server devuelve error claro nombrando
  al @user_no_amigo.
- Amigos actualmente jugando aparecen marcados visualmente y no se pueden agregar.
- Al aceptar una friend request, hay un atajo directo a crear partida con esa persona.
```

---

## Orden de ejecución sugerido

1. **O1 — FriendActionButton** (3-4h): mejora UX inmediata sin nuevas tablas. Shipping value alto.
2. **O2 — Notificaciones** (4-6h): requiere migration, realtime y bell. Es la base para
   futuras notificaciones (match invites, etc.).
3. **O3 — Restricción + empty states** (2-3h): consolida el flujo, mejora onboarding.

**Total estimado:** 9-13 horas de Claude Code distribuidas en 1-2 sesiones por story.

## Notas técnicas globales

- **Supabase Realtime:** confirmar que está habilitado para la tabla `notifications` después de
  correr la migration. Database → Replication en el dashboard.

- **RLS en triggers:** las funciones `on_friend_request_created` y `on_friend_request_accepted`
  deben ser SECURITY DEFINER para poder insertar en notifications saltándose RLS (porque corren
  bajo el contexto del que ejecutó la acción, pero insertan para OTRO usuario).

- **Optimistic updates:** patrón importante en O1. El usuario hace tap, la UI cambia
  instantáneamente, y SI el servidor falla, se revierte. Esto sólo funciona bien si el flujo
  feliz es mayoritario (>95%); si hay muchas fallas, mejor mostrar loading explícito.

- **Bell badge animation:** framer-motion con key={unreadCount} para que React re-monte el badge
  cuando cambia el número, disparando la animación bounce de entrada. UX detail muy notable.

- **Toast component:** si no existe ya, vale la pena crear uno reutilizable con framer-motion.
  Una implementación mínima con context API + provider en el layout es suficiente.

- **Timestamp relativos en español:** usa Intl.RelativeTimeFormat o una librería como
  date-fns/formatDistanceToNow con locale es. Evitar moment.js (legacy/pesado).

## Best practices que Claude Code debe seguir

- TypeScript estricto: tipar las RelationStatus, NotificationType correctamente con
  discriminated unions.
- Server components donde se pueda, client components solo cuando hay interactividad real.
- Mobile-first: todas las pantallas funcionan perfecto en 375px de ancho.
- Accesibilidad: aria-labels, focus visible, contraste WCAG AA, navegación teclado.
- Loading + error states explícitos. Nada de "se quedó cargando".
- No console.error sin context; usar mensajes específicos para debugging.
- Cleanup de subscripciones de Realtime en el useEffect return (unsubscribe).

Cuando termines cada story, commit con mensaje:
- O1: "feat(profile): smart friend action button with optimistic UI"
- O2: "feat(notifications): in-app notification system with realtime bell"
- O3: "feat(matches): friend-only matches with empty states and active indicators"
