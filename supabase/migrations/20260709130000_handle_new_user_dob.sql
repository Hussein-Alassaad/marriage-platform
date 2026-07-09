-- Phase 3: persist DOB at signup.
-- What: extend the existing handle_new_user() so the profile row also captures
--       date-of-birth from signup metadata (alongside display_name + gender).
-- Why: DOB must be set at registration so the existing min-age trigger enforces
--      the configurable `min_age` setting at the database level (frontend checks
--      are UX only). Additive only — no RLS or existing behavior weakened.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  insert into public.profiles (id, display_name, gender, dob)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    (nullif(new.raw_user_meta_data ->> 'gender', ''))::public.gender,
    (nullif(new.raw_user_meta_data ->> 'dob', ''))::date
  )
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, 'user')
  on conflict (user_id, role) do nothing;

  return new;
end;
$$;
