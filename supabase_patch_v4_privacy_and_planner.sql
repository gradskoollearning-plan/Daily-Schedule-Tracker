-- ============================================================
--  GRADSKOOL CAT 2026 TRACKER — Patch v4
--  Run this in Supabase SQL Editor AFTER the v3 schema.
--  1) Fixes a privacy leak: the old `public.leaderboard` VIEW
--     ran with the view-owner's privileges and exposed every
--     student's percentile/study-time/etc to every other
--     logged-in student, bypassing RLS.
--  2) Adds the `student_tasks` table for the new "My Planner"
--     tab (personal to-dos + custom schedule).
-- ============================================================

-- ── 1. Lock down the old raw leaderboard view ──────────────
-- Students can no longer query it directly. Admin still can
-- (Admin.js queries the underlying tables directly, which is
-- already protected by the "Admin read ..." policies — unaffected).
revoke select on public.leaderboard from authenticated;

-- ── 2. Privacy-safe leaderboard function ───────────────────
-- Returns rank + name for everyone (so the board still works),
-- but only returns real numbers (percentile, study time, etc.)
-- for the row that belongs to the calling user. Every other
-- row comes back with those fields set to NULL.
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

-- ── 3. Student tasks ("My Planner" tab) ─────────────────────
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

-- Fully private — not even admin can read these (per request:
-- "let one user have his/her privacy for everything").
create policy "Own tasks only" on public.student_tasks
  for all using (auth.uid() = user_id);

create index if not exists idx_st_user_date on public.student_tasks(user_id, date);
