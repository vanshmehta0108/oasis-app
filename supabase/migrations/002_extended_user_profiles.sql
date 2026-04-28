-- ══════════════════════════════════════════════════════════════════════════════
-- Sift — Extended user_profiles columns
-- Run this in Supabase → SQL Editor (or via: npx supabase db push)
-- ══════════════════════════════════════════════════════════════════════════════
-- Adds JSONB columns so scan history, compare list, bookmarks, and onboarding
-- state are stored in the database instead of only in localStorage.

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS onboarded        boolean   NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS scan_history     jsonb     NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS scan_count       integer   NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recent_searches  text[]    NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS compare_list     jsonb     NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS bookmarks        jsonb     NOT NULL DEFAULT '[]'::jsonb;

-- Full-text search index on product names and brands (fixes statement timeouts)
CREATE INDEX IF NOT EXISTS idx_products_name_trgm
  ON products USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_products_brand_trgm
  ON products USING gin (brand gin_trgm_ops);

-- Enable pg_trgm if not already enabled (required for above indexes)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Recreate indexes after extension (safe to re-run)
DROP INDEX IF EXISTS idx_products_name_trgm;
DROP INDEX IF EXISTS idx_products_brand_trgm;
CREATE INDEX IF NOT EXISTS idx_products_name_trgm  ON products USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_brand_trgm ON products USING gin (brand gin_trgm_ops);

-- RLS policies (safe to re-run)
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their own profile"   ON public.user_profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.user_profiles;

CREATE POLICY "Users can read their own profile"
  ON public.user_profiles FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
  ON public.user_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
  ON public.user_profiles FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
