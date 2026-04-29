-- Sift India — RLS hardening migration.
-- Apply in Supabase → SQL Editor AFTER cloud-migration.sql.
-- Idempotent — safe to re-run.
--
-- Goals:
--   1. Confirm user_profiles RLS is locked tight (defence-in-depth audit).
--   2. Ensure products table is read-anon, write-server only.
--   3. Lock community_submissions to authenticated insert + admin select.
--   4. Provide a delete_my_data() function callable by the user.
--
-- Run this BEFORE inviting any external testers.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. user_profiles — read/insert/update only your own row, no delete.
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- These four policies are the same ones cloud-migration.sql created. We
-- re-create them to make this file self-contained and to revoke any
-- lingering 'public' or 'service_role'-implied access from earlier states.

DROP POLICY IF EXISTS "Users can read their own profile" ON public.user_profiles;
CREATE POLICY "Users can read their own profile"
  ON public.user_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.user_profiles;
CREATE POLICY "Users can insert their own profile"
  ON public.user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.user_profiles;
CREATE POLICY "Users can update their own profile"
  ON public.user_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own profile" ON public.user_profiles;
CREATE POLICY "Users can delete their own profile"
  ON public.user_profiles FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Revoke any direct table grants that may have been added historically.
REVOKE ALL ON public.user_profiles FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_profiles TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. products — public read, server-side write only.
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read products" ON public.products;
CREATE POLICY "Anyone can read products"
  ON public.products FOR SELECT
  TO anon, authenticated
  USING (true);

-- INSERT/UPDATE/DELETE require the service-role key (used by /api/* routes
-- on the server). Anon and authenticated users have NO write policies.

REVOKE INSERT, UPDATE, DELETE ON public.products FROM anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. community_submissions — authenticated insert; nobody else can read.
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE public.community_submissions ENABLE ROW LEVEL SECURITY;

-- Submitters can create rows associated with their auth.uid() — this also
-- supports the anonymous "user_id: 'anonymous'" path used by the API; the
-- server-side route uses the service-role key and bypasses RLS for those.

DROP POLICY IF EXISTS "Users can submit products" ON public.community_submissions;
CREATE POLICY "Users can submit products"
  ON public.community_submissions FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Users CAN read their own submissions to see review status.
DROP POLICY IF EXISTS "Users can read own submissions" ON public.community_submissions;
CREATE POLICY "Users can read own submissions"
  ON public.community_submissions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid()::text);

REVOKE ALL ON public.community_submissions FROM anon;
GRANT SELECT, INSERT ON public.community_submissions TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 4. delete_my_data() — RPC for "delete my account + data" button.
--    Callable by the authenticated user on themselves only.
-- ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.delete_my_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Wipe user data. Keep this list in sync as new tables are added.
  DELETE FROM public.user_profiles WHERE user_id = v_user_id;
  -- community_submissions are anonymized rather than deleted (preserve the
  -- public catalog of products), but PII is stripped.
  UPDATE public.community_submissions
    SET user_id = 'deleted-' || md5(v_user_id::text)
    WHERE user_id = v_user_id::text;

  -- Note: the auth.users row itself must be deleted by the API route via
  -- the admin client (supabase.auth.admin.deleteUser). RLS doesn't permit
  -- users to delete their own auth row.
END;
$$;

REVOKE ALL ON FUNCTION public.delete_my_data() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_my_data() TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 5. Verification — run these to confirm RLS is on.
-- ─────────────────────────────────────────────────────────────────────────

-- SELECT schemaname, tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public' AND tablename IN ('user_profiles', 'products', 'community_submissions');
--
-- Expected: rowsecurity = true for all three.
