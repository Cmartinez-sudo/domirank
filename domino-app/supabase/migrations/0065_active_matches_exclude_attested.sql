-- ============================================================
-- 0065 — active_matches_per_user: excluir matches que el user ya firmó
-- ============================================================
-- Sprint Active Match Awareness — refinement post-review.
--
-- Regla de producto clarificada:
--   "Si la partida ya terminó (>=100 puntos) y yo ya la firmé, no debo
--    ver el chip 'Firmar resultado'. Pero sí debe seguir saliéndole a
--    los otros que aún no han firmado."
--
-- Modificación: la view `active_matches_per_user` ahora retorna 0 filas
-- para un user que YA tiene una entry en match_attestations (confirm o
-- dispute) del match.
--
-- Reglas resultantes:
--   • in_progress → todos los participantes lo ven como activo
--   • pending_attestation:
--       - participants sin attestation row → activo (chip ámbar)
--       - participants con attestation row → NO activo (chip oculto)
--   • confirmed/disputed/void/cancelled → no aparece (ya no era activo)
--
-- Side effect intencional: el single-active-match trigger (mig 0059)
-- usa esta view. Después de firmar, "tu" match desaparece del view →
-- podés empezar otro match nuevo. Eso refleja que tu participación
-- terminó (la firma es el END de tu involvement aunque la partida
-- siga esperando consenso del resto).
--
-- Dependencias: 0059 (view original), 0016 (match_attestations).
-- ============================================================

create or replace view public.active_matches_per_user as
select
  mp.user_id,
  m.id as match_id,
  m.status,
  m.created_at,
  m.format,
  m.target_points,
  m.created_by,
  m.scorekeeper_id as current_score_keeper_id,
  m.tournament_id
from public.match_players mp
join public.matches m on m.id = mp.match_id
where m.status = 'in_progress'
   or (
     m.status = 'pending_attestation'
     and not exists (
       select 1 from public.match_attestations a
        where a.match_id = m.id
          and a.user_id = mp.user_id
     )
   );

grant select on public.active_matches_per_user to authenticated;

comment on view public.active_matches_per_user is
  'Una fila por (user, match) cuando: status=in_progress (siempre) O status=pending_attestation Y el user aún no ha firmado. Single-active trigger usa esta view → al firmar, podés empezar match nuevo aunque el anterior siga pending consenso.';

-- ============================================================
-- VERIFICACIÓN
-- ============================================================
-- 1. User que firmó deja de aparecer:
--      select user_id, status from public.active_matches_per_user
--       where match_id = '<match-pending-attestation>';
--    Esperado: los que firmaron NO aparecen; los que no firmaron sí.
--
-- 2. in_progress no se afecta:
--      Para cualquier match in_progress, todos los participantes
--      siguen apareciendo en la view.
-- ============================================================
