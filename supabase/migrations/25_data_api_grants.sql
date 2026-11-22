-- Universal POS — migration 25: Supabase Data API grants
-- RLS policies remain the security boundary; this grants SQL privileges needed by PostgREST.
-- Existing rows and data are not changed. Safe to run again.
-- Run after migrations 01–24 on an existing project.

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- The helper is called by RLS policies and must be executable by authenticated users.
grant execute on function public.has_role(uuid, text[]) to authenticated;

notify pgrst, 'reload schema';
