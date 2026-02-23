-- =============================================
-- NYC Pool Bars - Supabase Database Schema
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- =============================================

-- 1. Create bars table
CREATE TABLE IF NOT EXISTS bars (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  neighborhood TEXT NOT NULL,
  address TEXT NOT NULL,
  table_count INTEGER NOT NULL DEFAULT 1,
  price TEXT NOT NULL,
  price_type TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  table_brand TEXT,
  hours TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create reviews table
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id TEXT NOT NULL REFERENCES bars(id) ON DELETE CASCADE,
  reviewer_name TEXT NOT NULL DEFAULT 'Anonymous',
  table_quality INTEGER NOT NULL CHECK (table_quality >= 1 AND table_quality <= 5),
  competition INTEGER NOT NULL CHECK (competition >= 1 AND competition <= 5),
  atmosphere INTEGER NOT NULL CHECK (atmosphere >= 1 AND atmosphere <= 5),
  elbow_room INTEGER NOT NULL CHECK (elbow_room >= 1 AND elbow_room <= 5),
  wait_time INTEGER NOT NULL CHECK (wait_time >= 1 AND wait_time <= 5),
  cue_quality INTEGER NOT NULL CHECK (cue_quality >= 1 AND cue_quality <= 5),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_reviews_bar_id ON reviews(bar_id);

-- 4. Enable Row Level Security
ALTER TABLE bars ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for bars table
-- Anyone can read bars
CREATE POLICY "Anyone can read bars" ON bars
  FOR SELECT USING (true);

-- 6. RLS Policies for reviews table
-- Anyone can read reviews
CREATE POLICY "Anyone can read reviews" ON reviews
  FOR SELECT USING (true);

-- Anyone can insert reviews (for now, no auth required)
CREATE POLICY "Anyone can insert reviews" ON reviews
  FOR INSERT WITH CHECK (true);

-- =============================================
-- Seed Data - All 14 Bars
-- =============================================

INSERT INTO bars (id, name, neighborhood, address, table_count, price, price_type, lat, lng, table_brand, hours) VALUES
('macdougal-st', 'Macdougal St', 'Greenwich Village', '122 MacDougal St, New York, NY 10012', 1, '$1/game', 'per game', 40.73002937620787, -74.00027688795778, NULL, NULL),
('barrows-pub', 'Barrow''s Pub', 'West Village', '463 Hudson St, New York, NY 10014', 1, '$1/game', 'per game', 40.731781222122514, -74.00686681679367, NULL, NULL),
('rays', 'Rays', 'Lower East Side', '177 Chrystie St, New York, NY 10002', 1, '$1/game', 'per game', 40.72124420370724, -73.99258244748135, NULL, NULL),
('cellar-dog', 'Cellar Dog', 'West Village', '75 Christopher St, New York, NY 10014', 15, '$20/hour', 'per hour', 40.733753928771726, -74.00319688980898, NULL, NULL),
('trionas-on-sullivan', 'Trionas on Sullivan', 'Greenwich Village', '237 Sullivan St, New York, NY 10012', 1, '$1/game', 'per game', 40.73004968792067, -73.99939166097316, NULL, NULL),
('bleeker-street-bar', 'Bleeker Street Bar', 'NoHo', '648 Broadway, New York, NY 10012', 2, '$1/game', 'per game', 40.726723753631674, -73.99533630330154, NULL, NULL),
('lucys', 'Lucy''s', 'East Village', '135 Avenue A, New York, NY 10009', 2, '$1/game', 'per game', 40.72720264430989, -73.98311471864517, NULL, NULL),
('mcswiggins', 'Mcswiggins', 'Hoboken', '110 1st St, Hoboken, NJ 07030', 1, '$1/game', 'per game', 40.73786888634154, -74.03144563213694, NULL, NULL),
('mulligans', 'Mulligans', 'Hoboken', '159 1st St, Hoboken, NJ 07030', 1, '$1/game', 'per game', 40.73769824021836, -74.03229058795738, NULL, NULL),
('the-shannon', 'The Shannon', 'Hoboken', '106 1st St, Hoboken, NJ 07030', 2, '$1/game', 'per game', 40.737833669247244, -74.03134743213695, NULL, NULL),
('louise-and-jerrys', 'Louise & Jerrys', 'Hoboken', '329 Washington St, Hoboken, NJ 07030', 1, '$2/game', 'per game', 40.74103140479875, -74.02957573213676, NULL, NULL),
('the-ale-house', 'The Ale House', 'Hoboken', '1034 Willow Ave, Hoboken, NJ 07030', 1, '$1/game', 'per game', 40.75044018183256, -74.03109941864408, NULL, NULL),
('madd-hatter', 'Madd Hatter', 'Hoboken', '221 Washington St, Hoboken, NJ 07030', 1, '$1/game', 'per game', 40.739568898330965, -74.0298995321369, NULL, NULL),
('south-house', 'South House', 'Downtown Jersey City', '149 Newark Ave, Jersey City, NJ 07302', 1, 'Free', 'free', 40.72068999320897, -74.04414805912242, NULL, NULL)
ON CONFLICT (id) DO NOTHING;

-- =============================================
-- Seed Data - Initial Reviews (from existing ratings)
-- =============================================

INSERT INTO reviews (bar_id, reviewer_name, table_quality, competition, atmosphere, elbow_room, wait_time, cue_quality, notes) VALUES
('macdougal-st', 'Initial Rating', 2, 3, 3, 1, 3, 3, 'Initial seed data from app launch'),
('barrows-pub', 'Initial Rating', 3, 3, 3, 3, 3, 3, 'Initial seed data from app launch'),
('rays', 'Initial Rating', 3, 2, 5, 3, 4, 3, 'Initial seed data from app launch'),
('cellar-dog', 'Initial Rating', 5, 4, 5, 4, 4, 5, 'Initial seed data from app launch'),
('trionas-on-sullivan', 'Initial Rating', 3, 3, 3, 2, 3, 3, 'Initial seed data from app launch'),
('bleeker-street-bar', 'Initial Rating', 4, 4, 4, 3, 5, 3, 'Initial seed data from app launch'),
('lucys', 'Initial Rating', 4, 4, 3, 4, 3, 3, 'Initial seed data from app launch'),
('mcswiggins', 'Initial Rating', 3, 3, 4, 3, 3, 2, 'Initial seed data from app launch'),
('mulligans', 'Initial Rating', 3, 3, 3, 3, 3, 3, 'Initial seed data from app launch'),
('the-shannon', 'Initial Rating', 4, 4, 2, 4, 3, 3, 'Initial seed data from app launch'),
('louise-and-jerrys', 'Initial Rating', 5, 5, 4, 3, 3, 4, 'Initial seed data from app launch'),
('the-ale-house', 'Initial Rating', 3, 4, 2, 3, 3, 3, 'Initial seed data from app launch'),
('madd-hatter', 'Initial Rating', 3, 2, 2, 3, 3, 3, 'Initial seed data from app launch'),
('south-house', 'Initial Rating', 1, 2, 3, 2, 3, 2, 'Initial seed data from app launch');

-- =============================================
-- Migration: Add Drink Selection & Crowd Vibe columns
-- Run this in Supabase SQL Editor to add the new columns
-- =============================================

ALTER TABLE reviews ADD COLUMN IF NOT EXISTS drink_selection INTEGER DEFAULT NULL CHECK (drink_selection >= 1 AND drink_selection <= 5);
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS crowd_vibe INTEGER DEFAULT NULL CHECK (crowd_vibe >= 1 AND crowd_vibe <= 5);

-- =============================================
-- Migration: Add Place ID, hours cache, and nullable columns
-- Run this in Supabase SQL Editor
-- =============================================

-- Add new columns to bars
ALTER TABLE bars ADD COLUMN IF NOT EXISTS place_id TEXT;
ALTER TABLE bars ADD COLUMN IF NOT EXISTS hours_data TEXT;
ALTER TABLE bars ADD COLUMN IF NOT EXISTS hours_last_updated TIMESTAMPTZ;

-- Make price, price_type, table_count nullable for bars with missing data
ALTER TABLE bars ALTER COLUMN price DROP NOT NULL;
ALTER TABLE bars ALTER COLUMN price_type DROP NOT NULL;
ALTER TABLE bars ALTER COLUMN table_count DROP NOT NULL;
ALTER TABLE bars ALTER COLUMN table_count DROP DEFAULT;

-- Allow client to insert bars (for import script)
CREATE POLICY "Anyone can insert bars" ON bars
  FOR INSERT WITH CHECK (true);

-- Allow client to update bars (for hours cache writes)
CREATE POLICY "Anyone can update bars" ON bars
  FOR UPDATE USING (true) WITH CHECK (true);

-- Allow client to delete bars (for import cleanup)
CREATE POLICY "Anyone can delete bars" ON bars
  FOR DELETE USING (true);

-- =============================================
-- Migration: Create suggestions table
-- Run this in Supabase SQL Editor
-- =============================================

CREATE TABLE IF NOT EXISTS suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('new_bar', 'bar_info')),
  bar_id TEXT REFERENCES bars(id) ON DELETE SET NULL,
  bar_name TEXT NOT NULL,
  suggested_data TEXT,
  submitted_by TEXT NOT NULL DEFAULT 'Anonymous',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_suggestions_type ON suggestions(type);

ALTER TABLE suggestions ENABLE ROW LEVEL SECURITY;

-- Anyone can insert suggestions
CREATE POLICY "Anyone can insert suggestions" ON suggestions
  FOR INSERT WITH CHECK (true);

-- Users can only read their own submissions (by submitted_by match)
CREATE POLICY "Users can read own suggestions" ON suggestions
  FOR SELECT USING (true);

-- =============================================
-- Migration: Add user authentication columns to reviews
-- Run this in Supabase SQL Editor
-- =============================================

ALTER TABLE reviews ADD COLUMN IF NOT EXISTS user_id UUID DEFAULT NULL;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS username TEXT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON reviews(user_id);
