-- 003_community_submissions_metadata.sql
--
-- Add brand + category columns to the community_submissions table so the
-- /add form can persist what the user enters (instead of forcing the
-- moderator to re-derive them on review).
--
-- Why: /api/add-product was attempting to insert these columns and silently
-- failing in prod with "Could not find the 'brand' column of
-- 'community_submissions' in the schema cache" — every form submission was
-- a 500. The hotfix (commit after this migration is created) drops the
-- columns from the insert and stuffs `brand` into `product_name` as a
-- parenthesised tail. This migration restores first-class storage.
--
-- After applying:
--   1. Run: psql $DB_URL -f supabase/migrations/003_community_submissions_metadata.sql
--      (or paste into the Supabase SQL Editor)
--   2. Update src/lib/database.types.ts to include `brand` and `category`
--      on community_submissions Row/Insert.
--   3. Restore the structured insert in src/app/api/add-product/route.ts —
--      remove the productNameForReview fallback and put brand/category
--      back on the insert object.
--   4. Update moderation route to read row.brand / row.category instead of
--      casting through Record<string, unknown>.

ALTER TABLE community_submissions
  ADD COLUMN IF NOT EXISTS brand TEXT,
  ADD COLUMN IF NOT EXISTS category TEXT;

-- Backfill is a no-op — old rows didn't carry this data anywhere persistent.
-- New rows will populate going forward.

-- Sanity: a single index on category helps the moderation queue filter by
-- category if we ever surface that filter in /admin.
CREATE INDEX IF NOT EXISTS community_submissions_category_idx
  ON community_submissions (category);
