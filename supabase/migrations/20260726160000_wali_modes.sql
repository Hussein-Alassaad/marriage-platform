-- Wali Modes (PRD "Wali Modes", lines ~4783-4809) — actually wired this time.
--
-- `wali_mode` was seeded in Phase 2 and deleted this session as dead cleanup
-- (20260726120000_plan_and_settings_cleanup.sql) because nothing read it. That
-- was too hasty — it is a real, specified requirement, just an unbuilt one. This
-- re-seeds it and wires it into `stage-transition`'s Serious-stage requirements:
--
--   recommended (default) — no gate. The nudge is informational only.
--   guided                — same as recommended: no gate, family involvement is
--                           surfaced as a recommendation, not required.
--   strict                — family involvement (the woman's guardian confirmed AND
--                           granted access to this match — the exact same check
--                           `family` stage already uses) becomes an ADDITIONAL
--                           requirement for entering Serious Communication, not
--                           only for reaching Family.
--
-- Recommended vs. Guided are functionally identical on purpose (both non-blocking);
-- the PRD's own distinction between them ("AI suggests" vs. "recommended") is a
-- copy/tone difference, not a mechanical one — there is no funded AI key to make an
-- "AI suggests" mode behave differently from a static recommendation banner, same
-- reasoning this platform already applies everywhere else a score or suggestion
-- would otherwise need a key it doesn't have.
insert into public.settings (key, value, type, is_public, description) values
  ('wali_mode', '"recommended"', 'string', true,
   'Family-involvement workflow before unlimited (Serious) communication: recommended | guided | strict (PRD Wali Modes)')
on conflict (key) do nothing;
