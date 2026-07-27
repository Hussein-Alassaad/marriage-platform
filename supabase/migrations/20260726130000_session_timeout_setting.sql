-- session_inactivity_minutes (seeded Phase 2) was never read anywhere — no idle
-- timeout existed. Now wired up client-side (SessionContext auto-signs-out after
-- this many minutes of no mouse/keyboard/touch activity). The value itself is not
-- sensitive (same category as intro_messages_per_person, family_images_per_day —
-- an operational number members are told about), so it needs to be public to be
-- readable by the client at all: the settings RLS policy only allows is_public
-- rows to be read by non-admins.
update public.settings set is_public = true where key = 'session_inactivity_minutes';
