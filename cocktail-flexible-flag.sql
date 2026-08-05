-- Adds an explicit "Flexible / no bottle needed" flag to cocktails,
-- fully decoupled from match categories (types). A cocktail can carry
-- real categories (Bourbon, Rye, etc.) for bottle-pairing purposes AND
-- be flagged flexible at the same time — the two aren't mutually
-- exclusive. Run this once in the Supabase SQL Editor, then the admin
-- panel's "Flexible — no bottle needed" checkbox will save correctly.

alter table public.cocktails
  add column if not exists wc_flexible boolean not null default false;
