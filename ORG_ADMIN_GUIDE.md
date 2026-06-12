# DomiRank Club Pro — Manual del administrador

Guía operativa para organizadores (Isabel, dueño de club, comité del torneo).

---

## Conceptos

- **Organización**: club o entidad que organiza torneos. Tiene branding (logo, color), members con roles (`owner`, `admin`, `staff`).
- **Torneo**: evento Swiss por parejas con N rondas. Una sola organización lo organiza. Solo puede haber **un torneo `in_progress` por organización** al mismo tiempo.
- **Pareja**: dos jugadores que compiten juntos. Cada uno tiene email propio. Los jugadores que aún no tienen cuenta DomiRank son "ghost users" hasta que activen via el email de invitación.
- **Ronda**: agrupa partidas (mesas). Los pairings se calculan automáticamente con sistema Suizo después de cada ronda.

## Cuentas y roles

| Rol | Puede |
|---|---|
| `owner` | Todo. Es quien creó la org. |
| `admin` | Crear/editar torneos, ingresar scores, marcar retiradas, enviar invitaciones. |
| `staff` | Solo lectura. Ver el dashboard sin poder modificar nada. |

## Flujo del día del torneo

### 1. Antes del evento (días/semanas antes)

1. Login en https://domirank.app.
2. Ir a **`/admin`** → seleccionar tu org.
3. Click **"Crear torneo"** (si ya hay uno activo, primero terminalo).
4. Wizard de 4 pasos:
   - **Info**: nombre, descripción, fecha, premio.
   - **Configuración Swiss**: número de rondas (típico 5-7), duración por ronda (típico 30-45 min), meta de tantos (típico 200).
   - **Parejas**: agregar mínimo 4. Por cada una: nombre + email de jugador A, nombre + email de jugador B.
   - **Revisar y crear**.
5. El torneo queda en estado **Borrador**.

### 2. Envío de invitaciones (cuando estés listo)

1. En el dashboard del torneo → tab **Resumen**.
2. Click **"Enviar invitaciones (N pendientes)"**.
3. Cada jugador recibe un email con un link único `/claim/<token>`.
4. El jugador clickea, setea contraseña, activa su cuenta.

> ⚠️ Los emails se mandan desde `noreply@domirank.app`. Si un jugador no lo encuentra, decile que mire spam o que busque "DomiRank".

### 3. Day of: iniciar torneo

1. Verificar que todos están presentes (no necesitan haber activado su cuenta — el torneo se puede iniciar sin que ningún jugador esté logueado).
2. Tab **Resumen** → click **"Iniciar torneo"**.
3. El sistema genera automáticamente los pairings de la Ronda 1.
4. Anunciar las mesas a los jugadores.
5. Abrir la pantalla pública en el TV del venue: `https://domirank.app/t/<slug>` (el slug está en tab **Configuración** y en **Resumen**).

### 4. Durante cada ronda

1. Tab **Rondas** → ves todas las mesas con campos para los scores.
2. Cuando termina una partida, ingresá los tantos finales (debe alcanzar la meta — si ingresás 180 con meta 200, el sistema rechaza).
3. Click **"Guardar"** por mesa.
4. Cuando todas las mesas terminan → tab **Resumen** → click **"Generar siguiente ronda"**.

### 5. Casos especiales

- **Pareja se retira**: tab **Parejas** → botón **"Marcar retirada"**. Sus resultados pasados cuentan, pero NO aparece en pairings de rondas futuras.
- **Empate al cierre por tiempo**: NO se permite. El reglamento exige mano de desempate — jueguen una mano extra y registren el ganador.
- **Bye (número impar de parejas)**: el sistema lo asigna automáticamente. La pareja con bye gana la ronda (+1 victoria) pero NO suma tantos. Rotación estricta: si todos tuvieron bye, va al que tuvo el bye más antiguo.

### 6. Final del torneo

- Al cerrar la última partida de la última ronda, el torneo pasa automáticamente a **Finalizado**.
- Tab **Clasificación** muestra el ranking final.
- La pantalla pública sigue accesible — el ranking queda preservado.

## Orden de desempate (FIJO por reglamento federación)

1. **Partidas ganadas** (PG)
2. **Coeficiente de Efectividad** (CE) — fórmula `±(1 − P_perdedor / meta)` sumado. Premia ganar contundente y perder ajustado.
3. **Tantos acumulados** (cap por meta)
4. **Head-to-head** (si dos parejas empatan en todo y se enfrentaron directamente)

## Player view

Los jugadores activados ven `/tournaments/club-pro/<id>`:
- Su próxima mesa.
- Histórico de sus partidas.
- Top 5 con su pareja highlighted.
- Link al display público para seguir en TV.

## Pantalla pública (display TV)

URL: `/t/<slug>`. Pública, sin login. Para proyectar en el venue:
- Browser fullscreen (F11).
- Auto-refresh via Realtime. Si cae la conexión, polling cada 15s.
- Branding del org (logo + color) en el header.
- Standings top 12 + matches de la ronda actual.
- Timer countdown desde el inicio de cada ronda.

## Troubleshooting

| Problema | Solución |
|---|---|
| Un jugador no recibe el email | Ver spam. Si no, contactar a Carlos para reenvío manual. |
| Olvidé un email al crear pares | Editar las pares no está disponible en v1. Borrá el torneo (estado Borrador) y empezalo de nuevo. |
| Necesito pausar el torneo | No hay pausa en v1. El timer es informativo — podés ingresar scores fuera de tiempo si necesitás. |
| Quiero editar un score ya guardado | No disponible en v1. Si el torneo NO terminó, contactanos. |

## Soporte

Para problemas técnicos durante un torneo: Carlos — `cmartinez@ridery.app`.
