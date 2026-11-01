-- 0009: plans (free / pro). Paid features (AI pictures, later AI video) check the plan.
-- Run once in Supabase SQL Editor. Safe to run again. Needs 0001 first.
--
-- Nobody can change a plan from the website: there are NO insert/update/delete policies.
-- Only you can, in the SQL Editor (see docs/SETUP.md, "Plans").

create table if not exists public.workspace_plans (
  workspace_id uuid primary key references public.workspaces (id) on delete cascade,
  plan         text not null default 'free' check (plan in ('free', 'pro')),
  updated_at   timestamptz not null default now()
);

alter table public.workspace_plans enable row level security;

drop policy if exists "Owners read their plan" on public.workspace_plans;
create policy "Owners read their plan"
  on public.workspace_plans for select to authenticated
  using (
    exists (
      select 1 from public.workspaces w
      where w.id = workspace_plans.workspace_id and w.owner_id = (select auth.uid())
    )
  );

-- Returns 'pro' when the signed-in user owns a workspace on the pro plan, otherwise 'free'.
create or replace function public.my_plan()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case when exists (
    select 1
    from public.workspace_plans p
    join public.workspaces w on w.id = p.workspace_id
    where w.owner_id = auth.uid() and p.plan = 'pro'
  ) then 'pro' else 'free' end;
$$;

revoke all on function public.my_plan() from public, anon;
grant execute on function public.my_plan() to authenticated;
