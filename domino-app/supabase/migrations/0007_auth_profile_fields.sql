-- ============================================================
-- DomiRank · migración 0007
-- Campos de perfil para flujo de registro completo (estilo chess.com):
--   - full_name (nombre completo del jugador, distinto del display_name)
--   - date_of_birth (para COPPA/edad mínima + estadísticas demográficas)
--   - terms_accepted_at, privacy_accepted_at (compliance legal)
--   - signup_method (email_password | magic_link | google | apple)
-- ============================================================

alter table public.profiles
  add column if not exists full_name           text,
  add column if not exists date_of_birth       date,
  add column if not exists terms_accepted_at   timestamptz,
  add column if not exists privacy_accepted_at timestamptz,
  add column if not exists signup_method       text
    check (signup_method in ('email_password','magic_link','google','apple') or signup_method is null);

-- Edad mínima: 13 años (cumplimiento COPPA/GDPR-K).
-- Se valida en el cliente y se enforcea aquí como defensa en profundidad.
create or replace function public.profile_age_check()
returns trigger language plpgsql as $$
begin
  if new.date_of_birth is not null and new.date_of_birth > current_date - interval '13 years' then
    raise exception 'edad_minima_13_anos' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_age_check on public.profiles;
create trigger profiles_age_check
  before insert or update of date_of_birth on public.profiles
  for each row execute function public.profile_age_check();

-- Trigger handle_new_user actualizado para extraer datos de raw_user_meta_data
-- (cuando el cliente los manda al sign-up: full_name, date_of_birth, signup_method).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_username  text;
  final_username text;
  counter        int := 0;
  meta_full_name text;
  meta_dob       date;
  meta_method    text;
  meta_terms     timestamptz;
begin
  meta_full_name := new.raw_user_meta_data->>'full_name';
  meta_method    := new.raw_user_meta_data->>'signup_method';
  meta_terms     := case when (new.raw_user_meta_data->>'terms_accepted')::boolean then now() else null end;
  begin
    meta_dob := (new.raw_user_meta_data->>'date_of_birth')::date;
  exception when others then meta_dob := null;
  end;

  -- Username basado en el email
  base_username := lower(regexp_replace(split_part(new.email, '@', 1), '[^a-z0-9_]', '', 'g'));
  if length(base_username) < 3 then
    base_username := 'player' || substr(replace(new.id::text, '-', ''), 1, 6);
  end if;
  base_username := substring(base_username from 1 for 20);
  final_username := base_username;
  while exists (select 1 from public.profiles where username = final_username) loop
    counter := counter + 1;
    final_username := substring(base_username from 1 for 20) || counter::text;
  end loop;

  insert into public.profiles (
    id, username, display_name,
    full_name, date_of_birth, signup_method,
    terms_accepted_at, privacy_accepted_at
  ) values (
    new.id,
    final_username,
    coalesce(meta_full_name, final_username),
    meta_full_name,
    meta_dob,
    meta_method,
    meta_terms,
    meta_terms
  );

  return new;
end;
$$;
