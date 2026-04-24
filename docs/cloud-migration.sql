-- Apply this in Supabase → SQL Editor.
--
-- Extends user_profiles with JSONB columns so every piece of
-- user data (scan history, compare list, recent searches, onboarded
-- flag, scan count) lives in the database instead of localStorage.
-- One row per user, loaded once on app startup.

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS onboarded boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS scan_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS scan_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recent_searches text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS compare_list jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Ensure RLS is on and policies exist (safe to re-run).
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their own profile" ON public.user_profiles;
CREATE POLICY "Users can read their own profile"
  ON public.user_profiles FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.user_profiles;
CREATE POLICY "Users can insert their own profile"
  ON public.user_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.user_profiles;
CREATE POLICY "Users can update their own profile"
  ON public.user_profiles FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
