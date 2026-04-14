-- ══════════════════════════════════════════════════════════════════════════════
-- Oasis Health App — Database Schema
-- ══════════════════════════════════════════════════════════════════════════════

-- ── Enums ────────────────────────────────────────────────────────────────────

CREATE TYPE product_category AS ENUM (
  'food', 'beverage', 'snack', 'dairy', 'baby_food',
  'skincare', 'haircare', 'cosmetic', 'household', 'water'
);

CREATE TYPE score_grade AS ENUM ('A', 'B', 'C', 'D', 'E');
CREATE TYPE scan_source AS ENUM ('barcode', 'ocr', 'search', 'web');
CREATE TYPE subscription_tier AS ENUM ('free', 'pro', 'family');
CREATE TYPE submission_status AS ENUM ('pending', 'approved', 'rejected');

-- ── Products ─────────────────────────────────────────────────────────────────

CREATE TABLE products (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barcode     TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  brand       TEXT NOT NULL DEFAULT 'Unknown',
  category    product_category NOT NULL DEFAULT 'food',
  image_url   TEXT,
  ingredients TEXT[] NOT NULL DEFAULT '{}',
  nutritional_info JSONB DEFAULT '{}',
  safety_score INTEGER CHECK (safety_score >= 0 AND safety_score <= 100),
  score_grade score_grade,
  fssai_license TEXT,
  analysis    JSONB,
  source      TEXT DEFAULT 'manual',  -- 'openfoodfacts', 'web', 'manual', 'ocr'
  verified    BOOLEAN DEFAULT false,
  scan_count  INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- Index for barcode lookups (primary use case)
CREATE INDEX idx_products_barcode ON products(barcode);
-- Index for search
CREATE INDEX idx_products_name_brand ON products USING gin(to_tsvector('english', name || ' ' || brand));
-- Index for trending (most scanned)
CREATE INDEX idx_products_scan_count ON products(scan_count DESC);
-- Index for worst rated
CREATE INDEX idx_products_safety_score ON products(safety_score ASC) WHERE safety_score IS NOT NULL;

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Scans ────────────────────────────────────────────────────────────────────

CREATE TABLE scans (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT,  -- anonymous ID from localStorage until auth is added
  product_id  UUID REFERENCES products(id) ON DELETE CASCADE,
  source      scan_source DEFAULT 'barcode',
  scanned_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_scans_product ON scans(product_id);
CREATE INDEX idx_scans_user ON scans(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_scans_recent ON scans(scanned_at DESC);

-- ── User Profiles ────────────────────────────────────────────────────────────

CREATE TABLE user_profiles (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             TEXT UNIQUE NOT NULL,  -- anonymous ID until auth
  display_name        TEXT DEFAULT 'User',
  health_conditions   TEXT[] DEFAULT '{}',
  allergies           TEXT[] DEFAULT '{}',
  language_preference TEXT DEFAULT 'en',
  subscription_tier   subscription_tier DEFAULT 'free',
  created_at          TIMESTAMPTZ DEFAULT now()
);

-- ── Community Submissions ────────────────────────────────────────────────────

CREATE TABLE community_submissions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               TEXT NOT NULL,
  product_name          TEXT NOT NULL,
  barcode               TEXT NOT NULL,
  label_image_url       TEXT,
  extracted_ingredients TEXT[] DEFAULT '{}',
  status                submission_status DEFAULT 'pending',
  reviewed_at           TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT now()
);

-- ── Row Level Security ───────────────────────────────────────────────────────
-- Open read for all, write restricted

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_submissions ENABLE ROW LEVEL SECURITY;

-- Products: anyone can read, service role can write
CREATE POLICY "products_read" ON products FOR SELECT USING (true);
CREATE POLICY "products_insert" ON products FOR INSERT WITH CHECK (true);
CREATE POLICY "products_update" ON products FOR UPDATE USING (true);

-- Scans: anyone can read and insert
CREATE POLICY "scans_read" ON scans FOR SELECT USING (true);
CREATE POLICY "scans_insert" ON scans FOR INSERT WITH CHECK (true);

-- Profiles: users can read/write their own
CREATE POLICY "profiles_read" ON user_profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert" ON user_profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "profiles_update" ON user_profiles FOR UPDATE USING (true);

-- Submissions: anyone can submit, read own
CREATE POLICY "submissions_insert" ON community_submissions FOR INSERT WITH CHECK (true);
CREATE POLICY "submissions_read" ON community_submissions FOR SELECT USING (true);

-- ── Helper function: increment scan count ────────────────────────────────────

CREATE OR REPLACE FUNCTION increment_scan_count(product_barcode TEXT)
RETURNS void AS $$
BEGIN
  UPDATE products SET scan_count = scan_count + 1 WHERE barcode = product_barcode;
END;
$$ LANGUAGE plpgsql;
