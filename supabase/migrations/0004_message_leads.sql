-- Lets you mark a customer message as a sales lead, so Analytics can count real leads.
-- Run once in the Supabase SQL Editor. Safe to run more than once. Requires 0003_messages.sql.

alter table public.messages
  add column if not exists is_lead boolean not null default false;

create index if not exists messages_workspace_lead_idx
  on public.messages (workspace_id) where is_lead;
