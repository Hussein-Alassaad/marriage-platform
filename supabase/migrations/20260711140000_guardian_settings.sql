-- Guardian settings + write lockdown.
-- What: how long an invite code stays valid, and an explicit revoke so the whole
--       guardian relationship is written only by the `guardian` Edge Function.
-- Why: a self-declared guardian link is exactly the thing an attacker would forge.
--      RLS is already deny-by-default here (these tables have SELECT policies only);
--      the revoke makes a future permissive policy unable to open a write path by
--      accident.

insert into public.settings (key, value, type, is_public, description) values
  ('guardian_invite_expiry_days', '14', 'number', true,
   'How long a guardian invite code remains valid')
on conflict (key) do nothing;

revoke insert, update, delete on public.guardian_invitations from anon, authenticated;
revoke insert, update, delete on public.guardians from anon, authenticated;
revoke insert, update, delete on public.guardian_access from anon, authenticated;
