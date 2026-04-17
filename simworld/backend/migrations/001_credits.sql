-- Credits table for SimWorld billing
-- Run this in Supabase SQL Editor (supabase.com → project → SQL Editor)

create table if not exists credits (
  id uuid default gen_random_uuid() primary key,
  org_id text not null,
  credits_purchased int not null default 0,
  credits_used int not null default 0,
  period_start timestamptz not null default now(),
  period_end timestamptz not null default (now() + interval '30 days'),
  created_at timestamptz not null default now()
);

-- Index for fast lookups by org
create index if not exists idx_credits_org_id on credits(org_id);

-- Row-level security
alter table credits enable row level security;

-- Service role can do everything (backend uses service key)
create policy "Service role full access" on credits
  for all using (true) with check (true);

-- Seed a default free-tier record for demo org
insert into credits (org_id, credits_purchased, credits_used, period_end)
values ('dev_org_001', 100, 0, now() + interval '30 days')
on conflict do nothing;
