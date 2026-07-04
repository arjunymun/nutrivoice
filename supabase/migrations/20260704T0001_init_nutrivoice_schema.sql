-- Applied to Supabase project `nutrivoice` (jqxqzhqzbiycjqjcllwd) via MCP on 2026-07-04.
-- Kept in-repo for reference / recreating the backend.

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text,
  sex text check (sex in ('male','female')),
  birth_year int check (birth_year between 1900 and 2026),
  height_cm numeric check (height_cm between 50 and 280),
  weight_kg numeric check (weight_kg between 20 and 400),
  activity_level text check (activity_level in ('sedentary','light','moderate','active','very_active')),
  goal text check (goal in ('cut','maintain','bulk')),
  target_kcal int,
  target_protein_g int,
  target_carbs_g int,
  target_fat_g int,
  updated_at timestamptz not null default now()
);

create table public.food_logs (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  logged_at date not null,
  meal text not null check (meal in ('breakfast','lunch','dinner','snack')),
  food_id text,
  name text not null,
  grams numeric not null check (grams > 0),
  kcal numeric not null check (kcal >= 0),
  protein_g numeric not null default 0,
  carbs_g numeric not null default 0,
  fat_g numeric not null default 0,
  source text not null default 'manual' check (source in ('voice','search','barcode','manual','ai')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);
create index food_logs_user_date_idx on public.food_logs (user_id, logged_at);

create table public.custom_foods (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  kcal_100g numeric not null check (kcal_100g >= 0),
  protein_100g numeric not null default 0,
  carbs_100g numeric not null default 0,
  fat_100g numeric not null default 0,
  barcode text,
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);
create index custom_foods_user_idx on public.custom_foods (user_id);

create table public.weight_logs (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  logged_at date not null,
  weight_kg numeric not null check (weight_kg between 20 and 400),
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);
create index weight_logs_user_date_idx on public.weight_logs (user_id, logged_at);

alter table public.profiles enable row level security;
alter table public.food_logs enable row level security;
alter table public.custom_foods enable row level security;
alter table public.weight_logs enable row level security;

create policy "own profile" on public.profiles for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own food logs" on public.food_logs for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own custom foods" on public.custom_foods for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own weight logs" on public.weight_logs for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 20260704T0002 add_custom_targets_flag
alter table public.profiles add column custom_targets boolean not null default false;
