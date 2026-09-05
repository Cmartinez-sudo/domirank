-- Fase 4: Self-assessment de skill inicial
alter table public.profiles
  add column if not exists initial_skill_points integer;
