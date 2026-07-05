-- Applied to Supabase project `nutrivoice` (jqxqzhqzbiycjqjcllwd) via MCP on 2026-07-05.
-- Gym module: workouts, workout_sets (flat rows for LWW sync), routines, custom_exercises.

create table public.workouts (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  started_at timestamptz not null,
  name text not null default 'Workout',
  notes text,
  duration_s int, -- null = in progress
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);
create index workouts_user_updated_idx on public.workouts (user_id, updated_at);
create index workouts_user_started_idx on public.workouts (user_id, started_at);

create table public.workout_sets (
  id uuid primary key,
  workout_id uuid not null references public.workouts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id text not null,
  set_number int not null check (set_number >= 1),
  weight_kg numeric check (weight_kg >= 0),
  reps int check (reps >= 0),
  duration_s int check (duration_s >= 0),
  rpe numeric check (rpe between 1 and 10),
  is_warmup boolean not null default false,
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);
create index workout_sets_user_updated_idx on public.workout_sets (user_id, updated_at);
create index workout_sets_workout_idx on public.workout_sets (workout_id);

create table public.routines (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  items jsonb not null default '[]',
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);
create index routines_user_idx on public.routines (user_id);

create table public.custom_exercises (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  primary_muscle text not null default 'full_body',
  equipment text not null default 'other',
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);
create index custom_exercises_user_idx on public.custom_exercises (user_id);

alter table public.workouts enable row level security;
alter table public.workout_sets enable row level security;
alter table public.routines enable row level security;
alter table public.custom_exercises enable row level security;

create policy "own workouts" on public.workouts for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own workout sets" on public.workout_sets for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own routines" on public.routines for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own custom exercises" on public.custom_exercises for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
