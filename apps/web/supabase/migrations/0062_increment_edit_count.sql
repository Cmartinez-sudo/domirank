-- ============================================================
-- 0062 — increment_edit_count helper (atomic)
-- ============================================================
-- Sprint Active Match Awareness — C6 (split from 0061 due to ordering).
--
-- Wraps "edit_count = edit_count + 1" in a security-definer RPC so
-- direct edits (author < 5min, host override) can bump the counter
-- atomically without race conditions.
-- ============================================================

create or replace function public.increment_edit_count(p_round_id bigint)
returns void
language sql
security definer
set search_path = public
as $$
  update public.match_rounds
     set edit_count = edit_count + 1
   where id = p_round_id;
$$;

grant execute on function public.increment_edit_count(bigint) to authenticated;
