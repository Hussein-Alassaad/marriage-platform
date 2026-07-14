-- Conversation summaries: dropped from the product, not merely left unbuilt.
--
-- The PRD had the platform generating an AI summary of a couple's conversation every N
-- messages for paid tiers. That is being removed by decision, and it is worth saying why
-- rather than quietly leaving a disabled job in the registry for someone to "finish" later:
-- summarising a private courtship conversation means a machine reads it and writes down
-- what it thinks the two of them meant. This platform's moderation already reads messages
-- to keep people safe, which is a cost members accept for a reason they understand.
-- Summarising them for convenience is a second, different intrusion with no safety
-- justification behind it.
--
-- Removing the registry row and the setting means the next person cannot switch this on by
-- accident. The `prompt_templates` / `ai_requests` enum comments still list the task name;
-- they are free-text comments, not constraints, and rewriting history to hide the idea
-- would be dishonest about what the product used to intend.

delete from public.scheduled_jobs where name = 'conversation_summaries';
delete from public.settings where key = 'conversation_summary_interval';
