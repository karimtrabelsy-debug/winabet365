WinaBet365 — Netlify + Supabase starter

1. Create a GitHub repository and upload the CONTENTS of this folder.
2. In Netlify: Add new project > Import an existing project > select the repo.
   Build command: leave blank. Publish directory: public.
3. In Supabase SQL Editor, run supabase-schema.sql.
4. In Netlify > Site configuration > Environment variables, add:
   MOVIODDS_API_KEY = your MoviOdds key
   SUPABASE_URL = your Supabase Project URL
   SUPABASE_SECRET_KEY = your Supabase secret key (server-side only)
5. Trigger a new deploy after adding variables.

The browser polls /.netlify/functions/odds about once per minute. This is periodic
refresh, not true streaming. Verify the provider's endpoint, response schema,
plan limits, and data redistribution rights before public/commercial use.
Never expose SUPABASE_SECRET_KEY or MOVIODDS_API_KEY in frontend code.
