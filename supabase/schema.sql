-- Oasis India — Full Database Schema

-- Enums
CREATE TYPE product_category AS ENUM (
  'food', 'beverage', 'snack', 'dairy', 'baby_food',
  'skincare', 'haircare', 'cosmetic', 'household', 'water'
);

CREATE TYPE score_grade AS ENUM ('A', 'B', 'C', 'D', 'E');
CREATE TYPE scan_source AS ENUM ('barcode', 'ocr', 'search');
CREATE TYPE subscription_tier AS ENUM ('free', 'pro', 'family');
CREATE TYPE submission_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE water_source AS ENUM ('tap', 'borewell', 'packaged');

-- Products
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barcode TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  brand TEXT NOT NULL,
  category product_category NOT NULL,
  image_url TEXT,
  ingredients TEXT[] NOT NULL DEFAULT '{}',
  nutritional_info JSONB NOT NULL DEFAULT '{}',
  safety_score INT CHECK (safety_score >= 0 AND safety_score <= 100),
  score_grade score_grade,
  fssai_license TEXT,
  analysis JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  verified BOOLEAN NOT NULL DEFAULT false,
  scan_count INT NOT NULL DEFAULT 0
);

CREATE INDEX idx_products_barcode ON products (barcode);
CREATE INDEX idx_products_category ON products (category);
CREATE INDEX idx_products_brand ON products (brand);
CREATE INDEX idx_products_scan_count ON products (scan_count DESC);

-- Scans
CREATE TABLE scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source scan_source NOT NULL
);

CREATE INDEX idx_scans_product_id ON scans (product_id);
CREATE INDEX idx_scans_user_id ON scans (user_id);

-- User Profiles
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  health_conditions TEXT[] NOT NULL DEFAULT '{}',
  allergies TEXT[] NOT NULL DEFAULT '{}',
  language_preference TEXT NOT NULL DEFAULT 'en',
  subscription_tier subscription_tier NOT NULL DEFAULT 'free',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Community Submissions
CREATE TABLE community_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  barcode TEXT NOT NULL,
  label_image_url TEXT NOT NULL,
  extracted_ingredients TEXT[] NOT NULL DEFAULT '{}',
  status submission_status NOT NULL DEFAULT 'pending',
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_community_submissions_status ON community_submissions (status);

-- Water Quality
CREATE TABLE water_quality (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  district TEXT NOT NULL,
  state TEXT NOT NULL,
  source water_source NOT NULL,
  ph NUMERIC NOT NULL,
  tds NUMERIC NOT NULL,
  hardness NUMERIC NOT NULL,
  contaminants JSONB NOT NULL DEFAULT '{}',
  tested_at TIMESTAMPTZ NOT NULL,
  data_source TEXT NOT NULL
);

CREATE INDEX idx_water_quality_state ON water_quality (state);
CREATE INDEX idx_water_quality_district ON water_quality (state, district);

-- Auto-update updated_at on products
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

-- RLS Policies
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE water_quality ENABLE ROW LEVEL SECURITY;

-- Products: readable by everyone, writable by authenticated
CREATE POLICY "Products are publicly readable"
  ON products FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert products"
  ON products FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update products"
  ON products FOR UPDATE USING (auth.role() = 'authenticated');

-- Scans: users can read their own, anyone can insert (anonymous scans allowed)
CREATE POLICY "Users can read own scans"
  ON scans FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Anyone can insert scans"
  ON scans FOR INSERT WITH CHECK (true);

-- User Profiles: users can only access their own
CREATE POLICY "Users can read own profile"
  ON user_profiles FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE USING (auth.uid() = user_id);

-- Community Submissions: users can read own, insert own
CREATE POLICY "Users can read own submissions"
  ON community_submissions FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert submissions"
  ON community_submissions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Water Quality: publicly readable
CREATE POLICY "Water quality is publicly readable"
  ON water_quality FOR SELECT USING (true);
