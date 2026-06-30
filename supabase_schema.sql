-- ============================================================
--  GRADSKOOL CAT 2026 TRACKER — Supabase Schema v3
--  Run this FRESH in Supabase SQL Editor (replaces v2)
-- ============================================================

create extension if not exists "uuid-ossp";

-- ── Profiles ─────────────────────────────────────────────────
create table if not exists public.profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  name              text,
  email             text,
  is_admin          boolean default false,
  target_percentile numeric default 99,
  phone             text,
  notify_email      boolean default true,
  created_at        timestamptz default now()
);
alter table public.profiles enable row level security;
create policy "Own profile"    on public.profiles for all using (auth.uid() = id);
create policy "Admin read all" on public.profiles for select using (
  exists (select 1 from public.profiles p2 where p2.id = auth.uid() and p2.is_admin = true)
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)));
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── Daily progress ────────────────────────────────────────────
create table if not exists public.daily_progress (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid references public.profiles(id) on delete cascade,
  date            date not null,
  step1           boolean default false,
  step2           boolean default false,
  step3           boolean default false,
  step4           boolean default false,
  step5           boolean default false,
  task_done       boolean default false,
  is_backlog      boolean default false,
  backlog_cleared boolean default false,
  notes           text,
  study_seconds   int default 0,
  updated_at      timestamptz default now(),
  unique(user_id, date)
);
alter table public.daily_progress enable row level security;
create policy "Own progress"       on public.daily_progress for all     using (auth.uid() = user_id);
create policy "Admin read progress" on public.daily_progress for select using (
  exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
);

-- ── Test scores ───────────────────────────────────────────────
create table if not exists public.test_scores (
  id               uuid primary key default uuid_generate_v4(),
  user_id          uuid references public.profiles(id) on delete cascade,
  date             date not null,
  test_name        text not null,
  test_type        text not null check (test_type in ('mock','sectional','area_test','marathon')),
  varc_score       numeric, varc_attempts int, varc_accuracy numeric,
  dilr_score       numeric, dilr_attempts int, dilr_accuracy numeric,
  qa_score         numeric, qa_attempts   int, qa_accuracy   numeric,
  total_score      numeric,
  percentile       numeric,
  overall_accuracy numeric,
  rank             int,
  notes            text,
  created_at       timestamptz default now(),
  unique(user_id, date, test_name)
);
alter table public.test_scores enable row level security;
create policy "Own scores"       on public.test_scores for all     using (auth.uid() = user_id);
create policy "Admin read scores" on public.test_scores for select using (
  exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
);

-- ── Leaderboard view ─────────────────────────────────────────
create or replace view public.leaderboard as
select
  p.id,
  p.name,
  count(distinct dp.date) filter (where dp.task_done)        as days_completed,
  coalesce(round(avg(ts.percentile)::numeric,1), 0)          as avg_percentile,
  coalesce(max(ts.percentile), 0)                             as best_percentile,
  coalesce(sum(dp.study_seconds), 0)                          as total_study_seconds,
  count(distinct ts.id) filter (where ts.test_type = 'mock') as mock_count
from public.profiles p
left join public.daily_progress dp on dp.user_id = p.id
left join public.test_scores ts    on ts.user_id  = p.id
where p.is_admin = false
group by p.id, p.name;

-- NOTE: intentionally NOT granted to `authenticated` — selecting this
-- view directly would leak every student's stats to every other student
-- (views run with the owner's privileges, bypassing RLS). Admin pages
-- query the underlying tables directly instead (protected by the
-- "Admin read ..." policies above). Students use the
-- public.get_leaderboard() function below, which only reveals real
-- numbers for their own row.

-- ── Indexes ───────────────────────────────────────────────────
create index if not exists idx_dp_user_date on public.daily_progress(user_id, date);
create index if not exists idx_ts_user_date on public.test_scores(user_id, date);

-- ── Privacy-safe leaderboard function ────────────────────────
-- Returns rank + name for every student, but only returns real
-- performance numbers for the row belonging to the calling user.
create or replace function public.get_leaderboard()
returns table (
  id uuid,
  name text,
  rank int,
  is_me boolean,
  days_completed bigint,
  avg_percentile numeric,
  best_percentile numeric,
  total_study_seconds bigint,
  mock_count bigint
)
language sql
security definer
stable
as $$
  with base as (
    select
      p.id,
      p.name,
      count(distinct dp.date) filter (where dp.task_done)        as days_completed,
      coalesce(round(avg(ts.percentile)::numeric,1),0)            as avg_percentile,
      coalesce(max(ts.percentile),0)                              as best_percentile,
      coalesce(sum(dp.study_seconds),0)                           as total_study_seconds,
      count(distinct ts.id) filter (where ts.test_type='mock')    as mock_count
    from public.profiles p
    left join public.daily_progress dp on dp.user_id = p.id
    left join public.test_scores ts    on ts.user_id  = p.id
    where p.is_admin = false
    group by p.id, p.name
  ),
  ranked as (
    select *,
      rank() over (order by avg_percentile desc, days_completed desc) as rnk
    from base
  )
  select
    id, name, rnk as rank, (id = auth.uid()) as is_me,
    case when id = auth.uid() then days_completed       else null end,
    case when id = auth.uid() then avg_percentile        else null end,
    case when id = auth.uid() then best_percentile        else null end,
    case when id = auth.uid() then total_study_seconds    else null end,
    case when id = auth.uid() then mock_count              else null end
  from ranked
  order by rnk;
$$;

grant execute on function public.get_leaderboard() to authenticated;

-- ── Student tasks ("My Planner" tab) ─────────────────────────
-- Fully private — no admin-read policy on purpose.
create table if not exists public.student_tasks (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references public.profiles(id) on delete cascade,
  title       text not null,
  notes       text,
  date        date,              -- null = unscheduled / someday item
  done        boolean default false,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
alter table public.student_tasks enable row level security;
create policy "Own tasks only" on public.student_tasks for all using (auth.uid() = user_id);
create index if not exists idx_st_user_date on public.student_tasks(user_id, date);
