-- Scheduler inside Supabase: calls the meta-cron function so approved posts go out on time
-- and new comments reach the Inbox. Replaces the unreliable GitHub schedule (which can run hours late).
-- Safe to run more than once. Needs two secrets in Supabase Vault (see docs/SETUP.md, "Scheduler"):
--   project_url  e.g. https://wdgkekjqxodhvrfedeyc.supabase.co
--   cron_secret  the same text as the CRON_SECRET Edge Function secret
-- Until both exist the job does nothing.

create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function public.run_meta_cron(skip_comments boolean default false)
returns void
language plpgsql
security definer
set search_path = public, extensions, vault
as $$
declare
  base text;
  secret text;
begin
  select decrypted_secret into base from vault.decrypted_secrets where name = 'project_url' limit 1;
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'cron_secret' limit 1;
  if base is null or secret is null or base = '' or secret = '' then
    return;
  end if;
  perform net.http_post(
    url := rtrim(base, '/') || '/functions/v1/meta-cron' || case when skip_comments then '?comments=skip' else '' end,
    headers := jsonb_build_object('content-type', 'application/json', 'x-cron-secret', secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 150000
  );
end;
$$;

-- Only the database itself (cron) may start it, never a browser user.
revoke all on function public.run_meta_cron(boolean) from public, anon, authenticated;

-- Every minute: publish due posts. Every 5 minutes: also import new comments.
select cron.schedule('meta-cron-publish', '* * * * *', $$select public.run_meta_cron(true)$$);
select cron.schedule('meta-cron-full', '*/5 * * * *', $$select public.run_meta_cron(false)$$);
