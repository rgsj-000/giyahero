create extension if not exists pgcrypto;

create table public.app_health (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

alter table public.app_health enable row level security;

create policy "app_health service only"
on public.app_health
for all
to service_role
using (true)
with check (true);
