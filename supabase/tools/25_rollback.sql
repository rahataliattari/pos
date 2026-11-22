-- Universal POS — migration 25 rollback
-- Removes the explicit Data API table/sequence grants introduced by migration 25.
-- Does not alter RLS policies or data. Run only if reverting migration 25.
revoke select, insert, update, delete on all tables in schema public from authenticated;
revoke usage, select on all sequences in schema public from authenticated;
notify pgrst, 'reload schema';
