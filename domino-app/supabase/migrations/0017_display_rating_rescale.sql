-- ============================================================
-- DomiRank · migración 0017 — rescale del display rating
--
-- Bajar el ancla de ordinal 35 → 28. Los "élite" reales llegan a
-- ordinal ~29-30, no a 35 como suponía la fórmula original. Esto
-- libera los tiers "Leyenda" (18-20) para los top players.
--
-- Cambio: usuarios existentes verán su display_rating subir un poco,
-- pero la posición relativa en el leaderboard no cambia.
-- ============================================================

create or replace function public.to_display_rating(ordinal numeric)
returns numeric language sql immutable as $$
  select greatest(1.0, least(20.0, round((1.0 + (ordinal / 28.0) * 19.0) * 10) / 10.0))
$$;
