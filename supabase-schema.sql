create table if not exists public.odds_matches (
  match_id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.odds_matches enable row level security;

-- No public read/write policies are created. The Netlify Function writes using
-- the server-only Supabase secret key; never put that key in browser code.
