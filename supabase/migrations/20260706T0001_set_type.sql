-- Applied to Supabase project `nutrivoice` (jqxqzhqzbiycjqjcllwd) via MCP on 2026-07-06.
-- Hevy-style set classification. `warmup` sets are excluded from volume/e1RM/PRs;
-- `drop`/`failure` are informational. is_warmup is kept in sync for back-compat.

alter table public.workout_sets
  add column if not exists set_type text not null default 'normal'
  check (set_type in ('normal', 'warmup', 'drop', 'failure'));

-- backfill existing rows so set_type agrees with the legacy is_warmup flag
update public.workout_sets set set_type = 'warmup' where is_warmup = true and set_type = 'normal';
