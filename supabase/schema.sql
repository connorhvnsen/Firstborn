-- Run this once in the Supabase SQL editor for a new project.
-- It is idempotent — safe to re-run.

-- =============================================================
-- profiles: one row per auth user, holds the credit balance.
-- =============================================================
create table if not exists public.profiles (
  user_id            uuid primary key references auth.users(id) on delete cascade,
  credits            integer not null default 3 check (credits >= 0),
  stripe_customer_id text unique,
  created_at         timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_self_select" on public.profiles;
create policy "profiles_self_select"
  on public.profiles for select
  using (auth.uid() = user_id);

-- No INSERT/UPDATE/DELETE policies: mutations go through SECURITY DEFINER
-- functions below, which bypass RLS in a controlled way.

-- =============================================================
-- Auto-create a profile (with 3 free credits) for every new user.
-- =============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =============================================================
-- Atomic credit operations.
-- The "where credits > 0" clause + a single UPDATE statement is
-- a row-level lock for the duration of the statement, so two
-- concurrent requests cannot both decrement past zero.
-- =============================================================
create or replace function public.reserve_credit(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
     set credits = credits - 1
   where user_id = p_user_id and credits > 0;
  return found;
end;
$$;

create or replace function public.refund_credit(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
     set credits = credits + 1
   where user_id = p_user_id;
end;
$$;

create or replace function public.add_credits(p_user_id uuid, p_amount integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
     set credits = credits + p_amount
   where user_id = p_user_id;
end;
$$;

-- =============================================================
-- projects: groups generations together. Every user always has
-- at least one project; we auto-create one with a random name on
-- first visit (see get_or_create_default_project below).
-- =============================================================
create table if not exists public.projects (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now()
);

create index if not exists projects_user_id_created_at_idx
  on public.projects (user_id, created_at desc);

alter table public.projects enable row level security;

drop policy if exists "projects_self_select" on public.projects;
create policy "projects_self_select"
  on public.projects for select
  using (auth.uid() = user_id);

-- =============================================================
-- generations: one row per successful name generation, so users
-- can revisit past results. Inputs are stored alongside the
-- streamed output. RLS lets each user read their own rows;
-- inserts go through the service-role client in the API route.
-- =============================================================
create table if not exists public.generations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  description text not null,
  feeling     text,
  competitors text,
  output      text not null,
  created_at  timestamptz not null default now()
);

-- Add project_id to existing generations tables. Nullable while we
-- backfill, then enforced NOT NULL below.
alter table public.generations
  add column if not exists project_id uuid references public.projects(id) on delete cascade;

-- Backfill: any user with generations but no project gets one
-- "First Flame" project that adopts all of their existing rows.
do $$
declare
  rec record;
  new_project_id uuid;
begin
  for rec in
    select distinct g.user_id
    from public.generations g
    where g.project_id is null
  loop
    insert into public.projects (user_id, name)
    values (rec.user_id, 'First Flame')
    returning id into new_project_id;

    update public.generations
       set project_id = new_project_id
     where user_id = rec.user_id and project_id is null;
  end loop;
end$$;

-- Now that everything is backfilled, enforce NOT NULL.
alter table public.generations
  alter column project_id set not null;

create index if not exists generations_user_id_created_at_idx
  on public.generations (user_id, created_at desc);

create index if not exists generations_project_id_created_at_idx
  on public.generations (project_id, created_at desc);

alter table public.generations enable row level security;

drop policy if exists "generations_self_select" on public.generations;
create policy "generations_self_select"
  on public.generations for select
  using (auth.uid() = user_id);

-- =============================================================
-- get_or_create_default_project: returns the user's most recent
-- project, or creates one with the given name if they have none.
-- Used on first visit so the UI always has a project to render.
-- =============================================================
create or replace function public.get_or_create_default_project(
  p_user_id uuid,
  p_name    text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_id uuid;
  new_id uuid;
begin
  select id into existing_id
    from public.projects
   where user_id = p_user_id
   order by created_at desc
   limit 1;

  if existing_id is not null then
    return existing_id;
  end if;

  insert into public.projects (user_id, name)
       values (p_user_id, p_name)
    returning id into new_id;

  return new_id;
end;
$$;

-- =============================================================
-- Stripe webhook idempotency: insert (id) succeeds once,
-- subsequent deliveries of the same event no-op.
-- =============================================================
create table if not exists public.stripe_events (
  id         text primary key,
  created_at timestamptz not null default now()
);
