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
-- Stripe webhook idempotency: insert (id) succeeds once,
-- subsequent deliveries of the same event no-op.
-- =============================================================
create table if not exists public.stripe_events (
  id         text primary key,
  created_at timestamptz not null default now()
);
