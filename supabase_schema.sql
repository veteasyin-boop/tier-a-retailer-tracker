-- ========================================================
-- TIER A RETAILER TRACKER - BIHAR FIELD OPERATIONS
-- SUPABASE POSTGRESQL SCHEMA WITH REAL-TIME ENABLED
-- ========================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. ASSISTANTS / FIELD REPRESENTATIVES TABLE
CREATE TABLE IF NOT EXISTS public.assistants (
  name TEXT PRIMARY KEY,
  hq TEXT NOT NULL,
  district TEXT NOT NULL,
  target INTEGER DEFAULT 50,
  blocks TEXT[] DEFAULT '{}',
  password TEXT DEFAULT 'rep123',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. RETAILERS MASTER TABLE
CREATE TABLE IF NOT EXISTS public.retailers (
  id TEXT PRIMARY KEY,
  retailer TEXT NOT NULL,
  assistant TEXT REFERENCES public.assistants(name) ON UPDATE CASCADE ON DELETE SET NULL,
  hq TEXT,
  district TEXT NOT NULL,
  block TEXT NOT NULL,
  mobile TEXT,
  status TEXT DEFAULT 'Pending',
  potential_for TEXT,
  potential_sell TEXT,
  notes TEXT,
  verified_visit BOOLEAN DEFAULT FALSE,
  check_in_date TEXT,
  check_in_time TEXT,
  check_in_lat DOUBLE PRECISION,
  check_in_lng DOUBLE PRECISION,
  check_in_accuracy DOUBLE PRECISION,
  check_in_dist_km DOUBLE PRECISION,
  check_in_map_url TEXT,
  check_in_rep TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. LIVE GPS CHECK-IN AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS public.check_in_logs (
  id TEXT PRIMARY KEY,
  retailer_id TEXT NOT NULL,
  retailer TEXT NOT NULL,
  mobile TEXT,
  district TEXT NOT NULL,
  block TEXT NOT NULL,
  rep TEXT NOT NULL,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  timestamp BIGINT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  accuracy DOUBLE PRECISION,
  dist_km DOUBLE PRECISION,
  map_url TEXT,
  status TEXT DEFAULT 'Visited',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. DAILY TOUR PLANS (PJP) TABLE
CREATE TABLE IF NOT EXISTS public.tour_plans (
  id TEXT PRIMARY KEY, -- formatted as: rep_date (e.g. assistant_1_2026-09-28)
  rep_name TEXT NOT NULL,
  plan_date TEXT NOT NULL,
  retailer_ids TEXT[] DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. INDEXES FOR HIGH-SPEED GEOGRAPHIC & SEARCH QUERIES
CREATE INDEX IF NOT EXISTS idx_retailers_district ON public.retailers(district);
CREATE INDEX IF NOT EXISTS idx_retailers_block ON public.retailers(block);
CREATE INDEX IF NOT EXISTS idx_retailers_assistant ON public.retailers(assistant);
CREATE INDEX IF NOT EXISTS idx_retailers_status ON public.retailers(status);
CREATE INDEX IF NOT EXISTS idx_checkin_rep ON public.check_in_logs(rep);
CREATE INDEX IF NOT EXISTS idx_checkin_date ON public.check_in_logs(date);
CREATE INDEX IF NOT EXISTS idx_tour_rep_date ON public.tour_plans(rep_name, plan_date);

-- 7. ENABLE ROW LEVEL SECURITY (RLS)
ALTER TABLE public.assistants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retailers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.check_in_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tour_plans ENABLE ROW LEVEL SECURITY;

-- 8. OPEN ACCESS POLICIES FOR APP CLIENT (ANON ROLE)
DROP POLICY IF EXISTS "Allow public read on assistants" ON public.assistants;
DROP POLICY IF EXISTS "Allow public insert/update on assistants" ON public.assistants;
CREATE POLICY "Allow public read on assistants" ON public.assistants FOR SELECT USING (true);
CREATE POLICY "Allow public insert/update on assistants" ON public.assistants FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow public read on retailers" ON public.retailers;
DROP POLICY IF EXISTS "Allow public insert/update on retailers" ON public.retailers;
CREATE POLICY "Allow public read on retailers" ON public.retailers FOR SELECT USING (true);
CREATE POLICY "Allow public insert/update on retailers" ON public.retailers FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow public read on check_in_logs" ON public.check_in_logs;
DROP POLICY IF EXISTS "Allow public insert on check_in_logs" ON public.check_in_logs;
CREATE POLICY "Allow public read on check_in_logs" ON public.check_in_logs FOR SELECT USING (true);
CREATE POLICY "Allow public insert on check_in_logs" ON public.check_in_logs FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow public read on tour_plans" ON public.tour_plans;
DROP POLICY IF EXISTS "Allow public insert/update on tour_plans" ON public.tour_plans;
CREATE POLICY "Allow public read on tour_plans" ON public.tour_plans FOR SELECT USING (true);
CREATE POLICY "Allow public insert/update on tour_plans" ON public.tour_plans FOR ALL USING (true);

-- 9. ENABLE REAL-TIME REPLICATION
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.retailers;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.check_in_logs;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.assistants;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tour_plans;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- 10. DEFAULT 8 BIHAR FIELD ASSISTANTS SEED
INSERT INTO public.assistants (name, hq, district, target, blocks, password)
VALUES 
  ('Assistant 1 (West Patna)', 'Bihta', 'Patna', 116, ARRAY['Bihta', 'Maner', 'Bikram', 'Naubatpur', 'Danapur'], 'rep123'),
  ('Assistant 2 (Central/South Patna)', 'Phulwari Sharif', 'Patna', 103, ARRAY['Phulwari Sharif', 'Masaurhi', 'Punpun', 'Dhanarua', 'Sampatchak'], 'rep123'),
  ('Assistant 3 (East Patna)', 'Bakhtiarpur', 'Patna', 80, ARRAY['Bakhtiarpur', 'Barh', 'Mokama', 'Fatuha', 'Daniyawan', 'Pandarak'], 'rep123'),
  ('Assistant 4 (West Vaishali)', 'Hajipur', 'Vaishali', 99, ARRAY['Hajipur', 'Lalganj', 'Vaishali', 'Bhagwanpur', 'Garaul'], 'rep123'),
  ('Assistant 5 (East Vaishali)', 'Mahua', 'Vaishali', 79, ARRAY['Mahua', 'Jandaha', 'Patepur', 'Bidupur', 'Desri', 'Rajapakar'], 'rep123'),
  ('Assistant 6 (Rohtas)', 'Sasaram', 'Rohtas', 66, ARRAY['Sasaram', 'Dehri', 'Nokha', 'Karakat', 'Bikramganj', 'Sheosagar'], 'rep123'),
  ('Assistant 7 (Kaimur)', 'Bhabua', 'Kaimur', 7, ARRAY['Bhabua', 'Mohania', 'Kudra', 'Chainpur'], 'rep123'),
  ('Assistant 8 (Bhojpur & Buxar)', 'Behea', 'Bhojpur', 23, ARRAY['Behea', 'Jagdishpur', 'Arrah', 'Buxar', 'Dumraon'], 'rep123')
ON CONFLICT (name) DO NOTHING;

-- ========================================================
-- 11. MGO SOP (ASSISTANT) 100-POINT KPI EXTENSIONS
-- ========================================================

-- 11.1 FARMER ENGAGEMENT & MEETINGS (25 PTS PILLAR)
CREATE TABLE IF NOT EXISTS public.farmer_meetings (
  id TEXT PRIMARY KEY,
  assistant TEXT REFERENCES public.assistants(name) ON UPDATE CASCADE ON DELETE CASCADE,
  village TEXT NOT NULL,
  block TEXT NOT NULL,
  district TEXT NOT NULL,
  crop TEXT NOT NULL,
  meeting_type TEXT DEFAULT 'Group Meeting', -- 'Group Meeting', 'Field Day', 'Mega Meeting'
  attendees_count INTEGER DEFAULT 0,
  lead_farmers JSONB DEFAULT '[]'::jsonb, -- [{ name, mobile, acre }]
  key_discussion TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  photo_url TEXT,
  date TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11.2 DEMO & TRIAL PLOTS LIFECYCLE (25 PTS PILLAR)
CREATE TABLE IF NOT EXISTS public.demo_plots (
  id TEXT PRIMARY KEY,
  assistant TEXT REFERENCES public.assistants(name) ON UPDATE CASCADE ON DELETE CASCADE,
  farmer_name TEXT NOT NULL,
  farmer_mobile TEXT,
  village TEXT NOT NULL,
  block TEXT NOT NULL,
  district TEXT NOT NULL,
  crop TEXT NOT NULL,
  hybrid_tested TEXT NOT NULL,
  competitor_check TEXT,
  sowing_date DATE,
  current_stage TEXT DEFAULT 'Sowing', -- 'Sowing', 'Vegetative', 'Flowering', 'Harvest'
  yield_result_kg_acre DOUBLE PRECISION,
  observations TEXT,
  photos TEXT[] DEFAULT '{}',
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11.3 COMPETITOR INTELLIGENCE (15 PTS PILLAR)
CREATE TABLE IF NOT EXISTS public.competitor_intel (
  id TEXT PRIMARY KEY,
  assistant TEXT REFERENCES public.assistants(name) ON UPDATE CASCADE ON DELETE CASCADE,
  retailer_id TEXT REFERENCES public.retailers(id) ON UPDATE CASCADE ON DELETE SET NULL,
  retailer_name TEXT,
  district TEXT NOT NULL,
  block TEXT NOT NULL,
  crop TEXT NOT NULL,
  competitor_brand TEXT NOT NULL,
  product_name TEXT NOT NULL,
  retail_price NUMERIC(10,2),
  dealer_price NUMERIC(10,2),
  promotional_scheme TEXT,
  farmer_sentiment TEXT DEFAULT 'Neutral', -- 'High Demand', 'Neutral', 'Declining'
  photo_url TEXT,
  date TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11.4 WEEKLY 100-POINT KPI SCORES & AUDIT HISTORY
CREATE TABLE IF NOT EXISTS public.assistant_kpi_scores (
  id TEXT PRIMARY KEY, -- formatted as: assistant_week (e.g. Assistant 1 (West Patna)_2026-W39)
  assistant TEXT REFERENCES public.assistants(name) ON UPDATE CASCADE ON DELETE CASCADE,
  week_code TEXT NOT NULL,
  tech_knowledge_pts NUMERIC(5,2) DEFAULT 0,    -- / 10 pts
  competitor_intel_pts NUMERIC(5,2) DEFAULT 0,  -- / 15 pts
  farmer_engagement_pts NUMERIC(5,2) DEFAULT 0, -- / 25 pts
  planning_sales_pts NUMERIC(5,2) DEFAULT 0,    -- / 25 pts
  aqfs_quality_pts NUMERIC(5,2) DEFAULT 0,      -- / 15 pts
  dealer_feedback_pts NUMERIC(5,2) DEFAULT 0,   -- / 10 pts
  total_score NUMERIC(5,2) DEFAULT 0,           -- / 100 pts
  grade TEXT DEFAULT 'Meets Expectations',       -- 'Exceptional', 'Strong', 'Meets Expectations', 'Improvement Required', 'PIP'
  manager_comments TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11.5 INDEXES FOR NEW MGO SOP TABLES
CREATE INDEX IF NOT EXISTS idx_farmer_meetings_assistant ON public.farmer_meetings(assistant);
CREATE INDEX IF NOT EXISTS idx_farmer_meetings_date ON public.farmer_meetings(date);
CREATE INDEX IF NOT EXISTS idx_demo_plots_assistant ON public.demo_plots(assistant);
CREATE INDEX IF NOT EXISTS idx_competitor_intel_assistant ON public.competitor_intel(assistant);
CREATE INDEX IF NOT EXISTS idx_competitor_intel_date ON public.competitor_intel(date);
CREATE INDEX IF NOT EXISTS idx_kpi_scores_assistant ON public.assistant_kpi_scores(assistant);

-- 11.6 ROW LEVEL SECURITY FOR NEW TABLES
ALTER TABLE public.farmer_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demo_plots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competitor_intel ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assistant_kpi_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public all on farmer_meetings" ON public.farmer_meetings FOR ALL USING (true);
CREATE POLICY "Allow public all on demo_plots" ON public.demo_plots FOR ALL USING (true);
CREATE POLICY "Allow public all on competitor_intel" ON public.competitor_intel FOR ALL USING (true);
CREATE POLICY "Allow public all on assistant_kpi_scores" ON public.assistant_kpi_scores FOR ALL USING (true);

-- 11.7 ENABLE REAL-TIME REPLICATION FOR NEW TABLES
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.farmer_meetings;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.demo_plots;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.competitor_intel;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.assistant_kpi_scores;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- ========================================================
-- 11.8 DEFAULT SEED DATA FOR BIHAR MGO FIELD OPERATIONS
-- ========================================================

-- Sample Farmer Meetings
INSERT INTO public.farmer_meetings (id, assistant, village, block, district, crop, meeting_type, attendees_count, lead_farmers, key_discussion, date)
VALUES
  ('fm_seed_001', 'Assistant 1 (West Patna)', 'Katesar', 'Bihta', 'Patna', 'Maize (Corn)', 'Group Meeting', 14, '[{"name": "Rameshwar Singh", "mobile": "9835012345", "acre": 4}, {"name": "Vijay Yadav", "mobile": "9431098765", "acre": 6}]'::jsonb, 'Demonstrated cob size and stay-green characteristics. Advised on weed management during early vegetative stage.', '2026-09-27'),
  ('fm_seed_002', 'Assistant 4 (West Vaishali)', 'Subhai', 'Hajipur', 'Vaishali', 'Vegetables (Cauliflower, Chilli, Tomato)', 'Field Day', 22, '[{"name": "Sanjay Kumar", "mobile": "9934123456", "acre": 2.5}]'::jsonb, 'Field day on curd firmness, disease resistance, and higher market price realization with local wholesale traders.', '2026-09-28'),
  ('fm_seed_003', 'Assistant 6 (Rohtas)', 'Karwandia', 'Sasaram', 'Rohtas', 'Paddy (Rice)', 'Field Day', 18, '[{"name": "Manoj Singh", "mobile": "9470876543", "acre": 5}]'::jsonb, 'Panicle length and grain filling demonstration. Strong farmer sentiment for next season pre-booking.', '2026-09-28')
ON CONFLICT (id) DO NOTHING;

-- Sample Demo & Trial Plots
INSERT INTO public.demo_plots (id, assistant, farmer_name, farmer_mobile, village, block, district, crop, hybrid_tested, competitor_check, sowing_date, current_stage, observations)
VALUES
  ('dp_seed_001', 'Assistant 1 (West Patna)', 'Dharmendra Pandey', '9470123456', 'Sikaria', 'Bihta', 'Patna', 'Maize (Corn)', 'Hy-Maize Gold 910', 'DKC 9108', '2026-08-10', 'Vegetative Growth', 'Excellent germination rate (96%). Vigorous root development and dark green canopy compared to competitor check plot.'),
  ('dp_seed_002', 'Assistant 4 (West Vaishali)', 'Raghunath Ray', '9835234567', 'Lalganj Proper', 'Lalganj', 'Vaishali', 'Vegetables (Cauliflower, Chilli, Tomato)', 'Super Hybrid Chilli 55', 'Syngenta Megha', '2026-08-01', 'Flowering / Tasseling', 'High fruit setting and resistance to leaf curl virus. Picking expected in 2 weeks.'),
  ('dp_seed_003', 'Assistant 6 (Rohtas)', 'Satendra Chaudhary', '9835876543', 'Barun', 'Dehri', 'Rohtas', 'Paddy (Rice)', 'Super Paddy 64', 'Arize 6444 Gold', '2026-07-15', 'Flowering / Tasseling', 'Tillering average 26 productive tillers/hill vs 21 in competitor check. Uniform flowering.')
ON CONFLICT (id) DO NOTHING;

-- Sample Competitor Market Intelligence
INSERT INTO public.competitor_intel (id, assistant, retailer_name, district, block, crop, competitor_brand, product_name, retail_price, dealer_price, promotional_scheme, farmer_sentiment, date)
VALUES
  ('ci_seed_001', 'Assistant 1 (West Patna)', 'Kisan Krishi Kendra', 'Patna', 'Bihta', 'Maize (Corn)', 'Corteva / Pioneer', 'Pioneer 3355', 2450.00, 2200.00, 'Free spray pump on purchase of 25 bags', 'High Demand', '2026-09-28'),
  ('ci_seed_002', 'Assistant 6 (Rohtas)', 'Maurya Khad Beej Bhandar', 'Rohtas', 'Sasaram', 'Paddy (Rice)', 'Bayer', 'Arize 6444 Gold', 980.00, 890.00, 'Cash discount Rs 30/bag on 7-day payment', 'High Demand', '2026-09-27'),
  ('ci_seed_003', 'Assistant 4 (West Vaishali)', 'Vaishali Seeds & Pesticides', 'Vaishali', 'Hajipur', 'Vegetables (Cauliflower, Chilli, Tomato)', 'Syngenta', 'Syngenta Megha', 1850.00, 1680.00, 'Gold coin scheme on 50 packets', 'Neutral', '2026-09-28')
ON CONFLICT (id) DO NOTHING;

-- ========================================================
-- 11.9 FARMER LEADS & MARKET DEVELOPMENT PIPELINE (25 PTS PILLAR)
-- Funnel: Awareness → Interest → Trial → Adoption → Repeat Demand
-- ========================================================
CREATE TABLE IF NOT EXISTS public.farmer_leads (
  id TEXT PRIMARY KEY,
  assistant TEXT REFERENCES public.assistants(name) ON UPDATE CASCADE ON DELETE CASCADE,
  farmer_name TEXT NOT NULL,
  mobile TEXT,
  village TEXT NOT NULL,
  block TEXT NOT NULL,
  district TEXT NOT NULL,
  crop TEXT NOT NULL,
  acreage DOUBLE PRECISION DEFAULT 1.0,
  farmer_category TEXT DEFAULT 'Progressive', -- 'Progressive', 'Influential', 'Commercial', 'Smallholder'
  product_interest TEXT NOT NULL,
  funnel_stage TEXT DEFAULT 'Awareness', -- 'Awareness', 'Interest', 'Trial', 'Adoption', 'Repeat Demand'
  assigned_dealer_id TEXT,
  assigned_dealer_name TEXT,
  demand_volume_bags INTEGER DEFAULT 2,
  follow_up_date DATE,
  follow_up_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================================================
-- 11.10 AQFS AUDIT & QUALITY SCORING TABLE (15 PTS PILLAR)
-- ========================================================
CREATE TABLE IF NOT EXISTS public.aqfs_audits (
  id TEXT PRIMARY KEY,
  assistant TEXT REFERENCES public.assistants(name) ON UPDATE CASCADE ON DELETE CASCADE,
  auditor TEXT DEFAULT 'Regional Sales Manager',
  week_code TEXT NOT NULL,
  compliance_score NUMERIC(3,1) DEFAULT 3.5,     -- max 4.0
  quality_score NUMERIC(3,1) DEFAULT 3.5,        -- max 4.0
  documentation_score NUMERIC(3,1) DEFAULT 2.5,  -- max 3.0
  followup_score NUMERIC(3,1) DEFAULT 2.0,       -- max 2.0
  accuracy_score NUMERIC(3,1) DEFAULT 2.0,       -- max 2.0
  total_aqfs_score NUMERIC(4,1) DEFAULT 13.5,    -- max 15.0
  coaching_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================================================
-- 11.11 WEEKLY OPERATING REVIEW & COMMITMENTS TABLE
-- ========================================================
CREATE TABLE IF NOT EXISTS public.weekly_reviews (
  id TEXT PRIMARY KEY,
  assistant TEXT REFERENCES public.assistants(name) ON UPDATE CASCADE ON DELETE CASCADE,
  week_code TEXT NOT NULL,
  planned_visits INTEGER DEFAULT 0,
  completed_visits INTEGER DEFAULT 0,
  farmer_meetings_count INTEGER DEFAULT 0,
  new_farmer_leads INTEGER DEFAULT 0,
  demos_active INTEGER DEFAULT 0,
  competitor_updates INTEGER DEFAULT 0,
  key_challenges TEXT,
  next_week_priorities TEXT,
  status TEXT DEFAULT 'Submitted', -- 'Draft', 'Submitted', 'Approved'
  manager_remarks TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for Leads, AQFS, and Weekly Reviews
CREATE INDEX IF NOT EXISTS idx_farmer_leads_assistant ON public.farmer_leads(assistant);
CREATE INDEX IF NOT EXISTS idx_farmer_leads_stage ON public.farmer_leads(funnel_stage);
CREATE INDEX IF NOT EXISTS idx_aqfs_audits_assistant ON public.aqfs_audits(assistant);
CREATE INDEX IF NOT EXISTS idx_weekly_reviews_assistant ON public.weekly_reviews(assistant);

-- RLS & Realtime
ALTER TABLE public.farmer_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aqfs_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public all on farmer_leads" ON public.farmer_leads FOR ALL USING (true);
CREATE POLICY "Allow public all on aqfs_audits" ON public.aqfs_audits FOR ALL USING (true);
CREATE POLICY "Allow public all on weekly_reviews" ON public.weekly_reviews FOR ALL USING (true);

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.farmer_leads;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.aqfs_audits;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.weekly_reviews;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- Sample Farmer Leads Seed
INSERT INTO public.farmer_leads (id, assistant, farmer_name, mobile, village, block, district, crop, acreage, farmer_category, product_interest, funnel_stage, assigned_dealer_name, demand_volume_bags, follow_up_date, follow_up_notes)
VALUES
  ('fl_seed_001', 'Assistant 1 (West Patna)', 'Rameshwar Singh', '9835012345', 'Sikaria', 'Bihta', 'Patna', 'Maize (Corn)', 4.0, 'Influential', 'Hy-Maize Gold 910', 'Interest', 'Kisan Krishi Kendra', 4, '2026-10-02', 'Interested in cob test; requested sample bag quotation for 4 acres.'),
  ('fl_seed_002', 'Assistant 1 (West Patna)', 'Dharmendra Pandey', '9470123456', 'Sikaria', 'Bihta', 'Patna', 'Maize (Corn)', 5.5, 'Progressive', 'Hy-Maize Gold 910', 'Trial', 'Kisan Krishi Kendra', 5, '2026-10-05', 'Active demo plot running in vegetative stage. Highly satisfied with root vigor.'),
  ('fl_seed_003', 'Assistant 4 (West Vaishali)', 'Sanjay Kumar', '9934123456', 'Subhai', 'Hajipur', 'Vaishali', 'Vegetables (Cauliflower, Chilli, Tomato)', 2.5, 'Commercial', 'Super Hybrid Chilli 55', 'Adoption', 'Vaishali Seeds & Pesticides', 8, '2026-10-01', 'Adopted for commercial season planting. Recommending to neighboring farmers.'),
  ('fl_seed_004', 'Assistant 6 (Rohtas)', 'Satendra Chaudhary', '9835876543', 'Barun', 'Dehri', 'Rohtas', 'Paddy (Rice)', 6.0, 'Progressive', 'Super Paddy 64', 'Repeat Demand', 'Maurya Khad Beej Bhandar', 12, '2026-09-30', 'Repeat buyer from last season. Booked 12 bags through Maurya Khad Beej.')
ON CONFLICT (id) DO NOTHING;


-- ========================================================
-- MIGRATION v2 — Run in Supabase SQL Editor if you see:
--   "Could not find table 'public.farmer_leads'" errors
-- This block is fully idempotent (safe to re-run).
-- ========================================================

-- Ensure farmer_leads exists
CREATE TABLE IF NOT EXISTS public.farmer_leads (
  id TEXT PRIMARY KEY,
  assistant TEXT REFERENCES public.assistants(name) ON UPDATE CASCADE ON DELETE CASCADE,
  farmer_name TEXT NOT NULL,
  mobile TEXT,
  village TEXT NOT NULL,
  block TEXT NOT NULL,
  district TEXT NOT NULL,
  crop TEXT NOT NULL,
  acreage DOUBLE PRECISION DEFAULT 1.0,
  farmer_category TEXT DEFAULT 'Progressive',
  product_interest TEXT NOT NULL,
  funnel_stage TEXT DEFAULT 'Awareness',
  assigned_dealer_id TEXT,
  assigned_dealer_name TEXT,
  demand_volume_bags INTEGER DEFAULT 2,
  follow_up_date DATE,
  follow_up_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure aqfs_audits exists
CREATE TABLE IF NOT EXISTS public.aqfs_audits (
  id TEXT PRIMARY KEY,
  assistant TEXT REFERENCES public.assistants(name) ON UPDATE CASCADE ON DELETE CASCADE,
  auditor TEXT DEFAULT 'Regional Sales Manager',
  week_code TEXT NOT NULL,
  compliance_score NUMERIC(3,1) DEFAULT 3.5,
  quality_score NUMERIC(3,1) DEFAULT 3.5,
  documentation_score NUMERIC(3,1) DEFAULT 2.5, 
  followup_score NUMERIC(3,1) DEFAULT 2.0,
  accuracy_score NUMERIC(3,1) DEFAULT 2.0,
  total_aqfs_score NUMERIC(4,1) DEFAULT 13.5,
  coaching_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure weekly_reviews exists
CREATE TABLE IF NOT EXISTS public.weekly_reviews (
  id TEXT PRIMARY KEY,
  assistant TEXT REFERENCES public.assistants(name) ON UPDATE CASCADE ON DELETE CASCADE,
  week_code TEXT NOT NULL,
  planned_visits INTEGER DEFAULT 0,
  completed_visits INTEGER DEFAULT 0,
  farmer_meetings_count INTEGER DEFAULT 0,
  new_farmer_leads INTEGER DEFAULT 0,
  demos_active INTEGER DEFAULT 0,
  competitor_updates INTEGER DEFAULT 0,
  key_challenges TEXT,
  next_week_priorities TEXT,
  status TEXT DEFAULT 'Submitted',
  manager_remarks TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_farmer_leads_assistant ON public.farmer_leads(assistant);
CREATE INDEX IF NOT EXISTS idx_farmer_leads_stage ON public.farmer_leads(funnel_stage);
CREATE INDEX IF NOT EXISTS idx_aqfs_audits_assistant ON public.aqfs_audits(assistant);
CREATE INDEX IF NOT EXISTS idx_weekly_reviews_assistant ON public.weekly_reviews(assistant);

-- RLS Policies
ALTER TABLE public.farmer_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aqfs_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public all on farmer_leads" ON public.farmer_leads;
DROP POLICY IF EXISTS "Allow public all on aqfs_audits" ON public.aqfs_audits;
DROP POLICY IF EXISTS "Allow public all on weekly_reviews" ON public.weekly_reviews;

CREATE POLICY "Allow public all on farmer_leads" ON public.farmer_leads FOR ALL USING (true);
CREATE POLICY "Allow public all on aqfs_audits" ON public.aqfs_audits FOR ALL USING (true);
CREATE POLICY "Allow public all on weekly_reviews" ON public.weekly_reviews FOR ALL USING (true);

-- Enable Real-time
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.farmer_leads;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.aqfs_audits;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.weekly_reviews;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- ========================================================
-- MIGRATION v3 — Quiz Studio & Daily Operating Cycle (EOD)
-- Run this in Supabase SQL Editor if you already ran v1/v2.
-- It is completely idempotent and will NOT touch existing data.
-- ========================================================

-- 1. AGRONOMY QUIZ QUESTION BANK
CREATE TABLE IF NOT EXISTS public.quiz_questions (
  id TEXT PRIMARY KEY,
  question TEXT NOT NULL,
  options TEXT[] NOT NULL,
  answer_index INTEGER NOT NULL,
  explanation TEXT,
  category TEXT DEFAULT 'Agronomy',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. FIELD REP WEEKLY QUIZ ATTEMPTS & SCORES
CREATE TABLE IF NOT EXISTS public.quiz_states (
  id TEXT PRIMARY KEY, -- assistant name
  assistant TEXT REFERENCES public.assistants(name) ON UPDATE CASCADE ON DELETE CASCADE,
  score INTEGER DEFAULT 0,
  total INTEGER DEFAULT 5,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. DAILY OPERATING CYCLE (EOD) WRAP-UP REPORTS
CREATE TABLE IF NOT EXISTS public.eod_reports (
  id TEXT PRIMARY KEY, -- e.g. asst_date (assistant_1_2026-09-29)
  assistant TEXT REFERENCES public.assistants(name) ON UPDATE CASCADE ON DELETE CASCADE,
  date TEXT NOT NULL,
  day_visits INTEGER DEFAULT 0,
  day_meetings INTEGER DEFAULT 0,
  day_intel INTEGER DEFAULT 0,
  highlights TEXT,
  bottlenecks TEXT,
  acknowledged BOOLEAN DEFAULT FALSE,
  manager_feedback TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_quiz_states_assistant ON public.quiz_states(assistant);
CREATE INDEX IF NOT EXISTS idx_eod_reports_assistant ON public.eod_reports(assistant);
CREATE INDEX IF NOT EXISTS idx_eod_reports_date ON public.eod_reports(date);

-- RLS
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eod_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public all on quiz_questions" ON public.quiz_questions;
DROP POLICY IF EXISTS "Allow public all on quiz_states" ON public.quiz_states;
DROP POLICY IF EXISTS "Allow public all on eod_reports" ON public.eod_reports;

CREATE POLICY "Allow public all on quiz_questions" ON public.quiz_questions FOR ALL USING (true);
CREATE POLICY "Allow public all on quiz_states" ON public.quiz_states FOR ALL USING (true);
CREATE POLICY "Allow public all on eod_reports" ON public.eod_reports FOR ALL USING (true);

-- Enable Real-time
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.quiz_questions;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.quiz_states;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.eod_reports;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- Default Seed Questions for Bihar Curriculum
INSERT INTO public.quiz_questions (id, question, options, answer_index, explanation, category)
VALUES
  ('q_001', 'What is the critical economic threshold level (ETL) for Fall Armyworm (Spodoptera frugiperda) in vegetative maize (V3–V6 stage)?', ARRAY['5% infested plants with fresh whorl frass', '10% infested plants with fresh whorl frass', '20% infested plants with fresh whorl frass', '35% infested plants with fresh whorl frass'], 1, 'In early whorl vegetative stage (V3–V6), the actionable ETL is 10% infested plants displaying pinhole/windowing damage and fresh frass in whorls.', 'Corn Agronomy'),
  ('q_002', 'Which macro/micronutrient deficiency in cauliflower is characterized by "whiptail" deformation of leaves and blind curd failure?', ARRAY['Zinc (Zn) deficiency', 'Boron (B) deficiency (Hollow stem)', 'Molybdenum (Mo) deficiency in acidic soils', 'Magnesium (Mg) deficiency'], 2, 'Molybdenum (Mo) deficiency causes whiptail symptoms in Brassica crops, particularly in acidic soils (pH < 5.5).', 'Vegetable Agronomy'),
  ('q_003', 'Under standard Bihar agro-climatic conditions, what is the optimum planting density (spacing) recommended for hybrid Rabi maize?', ARRAY['45 cm × 15 cm (148,000 plants/ha)', '60 cm × 20 cm (83,333 plants/ha)', '75 cm × 25 cm (53,333 plants/ha)', '90 cm × 30 cm (37,000 plants/ha)'], 1, 'Standard agronomic recommendation for single cross hybrid maize is 60 cm row-to-row and 20 cm plant-to-plant.', 'Corn Agronomy'),
  ('q_004', 'In direct-seeded or transplanted paddy, what is the optimum window for applying bispyribac-sodium 10% SC for post-emergence weed control?', ARRAY['Pre-sowing incorporated', '2–4 leaf stage of weeds (15–20 days after transplanting)', 'Panicle initiation stage (45 DAT)', 'Pre-harvest flag leaf stage'], 1, 'Bispyribac-sodium 10% SC is a selective systemic post-emergence herbicide optimal at 2–4 leaf stage of weeds.', 'Rice Agronomy'),
  ('q_005', 'According to MGO Field SOP, how many Tier-A dealer counters must a field representative visit daily during an active tour plan?', ARRAY['2–3 counters', '6–8 counters', '12–15 counters', '20+ counters'], 1, 'The core operating standard requires 6–8 quality counter visits daily with verified GPS check-in.', 'MGO Field SOP')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 11. PHYSICAL INVENTORY ALLOCATIONS & FIELD LIQUIDATION SCHEMA (MIGRATION v4)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.inventory_allocations (
  id TEXT PRIMARY KEY,
  product_name TEXT NOT NULL,
  crop TEXT NOT NULL DEFAULT 'General',
  category TEXT NOT NULL DEFAULT 'Hybrid Seeds',
  batch_no TEXT DEFAULT 'LOT-2026',
  unit TEXT NOT NULL DEFAULT 'packets', -- 'kg', 'packets', 'bags', 'liters', etc.
  target_rep TEXT NOT NULL,
  allocated_qty NUMERIC NOT NULL DEFAULT 0,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  season TEXT DEFAULT 'Rabi 2026',
  allocated_date DATE DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

CREATE TABLE IF NOT EXISTS public.inventory_movements (
  id TEXT PRIMARY KEY,
  allocation_id TEXT REFERENCES public.inventory_allocations(id) ON DELETE CASCADE,
  assistant TEXT NOT NULL,
  date DATE DEFAULT CURRENT_DATE,
  movement_type TEXT NOT NULL, -- 'liquidation', 'demo_sample', 'dealer_transfer', 'damage_return'
  quantity NUMERIC NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'packets',
  recipient_name TEXT NOT NULL,
  recipient_type TEXT DEFAULT 'dealer', -- 'dealer', 'farmer', 'demo_plot', 'other'
  invoice_ref_no TEXT,
  realized_price_per_unit NUMERIC DEFAULT 0,
  notes TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  gps_accuracy NUMERIC,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- Enable RLS
ALTER TABLE public.inventory_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Public Read/Write Inventory Allocations" ON public.inventory_allocations FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Public Read/Write Inventory Movements" ON public.inventory_movements FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Enable Realtime
DO $$ BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory_allocations;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory_movements;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- ============================================================================
-- 12. SMART TOUR BEAT PLANS & GPS-VERIFIED TA/DA MILEAGE CLAIMS (MIGRATION v5)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.tour_beat_plans (
  id TEXT PRIMARY KEY,
  assistant TEXT NOT NULL,
  date DATE NOT NULL,
  block TEXT,
  district TEXT,
  origin_name TEXT,
  origin_coords JSONB,
  total_km NUMERIC DEFAULT 0,
  total_driving_minutes INT DEFAULT 0,
  total_visit_minutes INT DEFAULT 0,
  total_shift_minutes INT DEFAULT 0,
  status TEXT DEFAULT 'Planned', -- 'Planned', 'In Progress', 'Completed'
  google_maps_url TEXT,
  stops JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

CREATE TABLE IF NOT EXISTS public.tada_claims (
  id TEXT PRIMARY KEY,
  assistant TEXT NOT NULL,
  hq TEXT,
  district TEXT,
  date DATE NOT NULL,
  verified_stops INT DEFAULT 0,
  gps_verified_km NUMERIC DEFAULT 0,
  claimed_km NUMERIC DEFAULT 0,
  fuel_rate NUMERIC DEFAULT 4.50,
  fuel_amount NUMERIC DEFAULT 0,
  da_amount NUMERIC DEFAULT 0,
  outstation_amount NUMERIC DEFAULT 0,
  incidental_amount NUMERIC DEFAULT 0,
  incidental_notes TEXT,
  total_claim_amount NUMERIC DEFAULT 0,
  approved_amount NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'Pending Approval', -- 'Pending Approval', 'Approved', 'Adjusted', 'Rejected'
  audit_flags JSONB DEFAULT '[]'::jsonb,
  manager_notes TEXT,
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- Enable RLS
ALTER TABLE public.tour_beat_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tada_claims ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Public Read/Write Tour Beat Plans" ON public.tour_beat_plans FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Public Read/Write TA-DA Claims" ON public.tada_claims FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Enable Realtime
DO $$ BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tour_beat_plans;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tada_claims;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
-- ============================================================================
-- INDIAN ATTENDANCE & MUSTER ROLL TABLES
-- Bihar AgTech Field Operations — Form XVI / Form D Compliance
-- ============================================================================

-- attendance_records: Daily punch-in / punch-out records for all reps
CREATE TABLE IF NOT EXISTS public.attendance_records (
  id                       TEXT PRIMARY KEY,                  -- 'att_<rep>_<date>'
  assistant                TEXT NOT NULL,                     -- Rep full name
  emp_code                 TEXT,                              -- AGT-001 through AGT-008
  hq                       TEXT,                             -- HQ station
  district                 TEXT,                             -- Bihar district
  date                     DATE NOT NULL,                     -- Attendance date
  punch_in                 TEXT,                             -- Display time e.g. '09:05 AM'
  punch_in_time            TIMESTAMPTZ,                      -- ISO timestamp
  punch_in_lat             FLOAT8,                          -- GPS latitude at punch-in
  punch_in_lng             FLOAT8,                          -- GPS longitude at punch-in
  punch_in_location_name   TEXT,                            -- Human-readable location
  punch_out                TEXT,                            -- Display time e.g. '06:20 PM'
  punch_out_time           TIMESTAMPTZ,                     -- ISO timestamp
  punch_out_lat            FLOAT8,                          -- GPS latitude at punch-out
  punch_out_lng            FLOAT8,                          -- GPS longitude at punch-out
  punch_out_location_name  TEXT,                            -- Human-readable location
  working_minutes          INTEGER DEFAULT 0,               -- Total worked minutes
  working_hours_formatted  TEXT,                            -- e.g. '9h 20m'
  work_mode                TEXT DEFAULT 'Field Operations',  -- Field / HQ / Tour / WFH
  status                   TEXT NOT NULL DEFAULT 'A',        -- P | HD | OD | WO | PL | CL | SL | H | A
  status_label             TEXT,                            -- Human-readable status label
  is_late                  BOOLEAN DEFAULT FALSE,           -- Punched in after grace period
  notes                    TEXT,                            -- Field notes / manager remarks
  regularization_requested BOOLEAN DEFAULT FALSE,           -- Punch correction requested
  regularization_reason    TEXT,                            -- Rep's reason for correction
  requested_status         TEXT,                            -- What rep is requesting
  regularization_status    TEXT DEFAULT 'None',             -- None | Pending | Approved | Rejected
  regularization_reviewed_by TEXT,                         -- Manager who approved/rejected
  regularization_reviewed_at TIMESTAMPTZ,                  -- When reviewed
  created_at               TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
  updated_at               TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),

  -- Indexes for fast monthly muster roll queries
  CONSTRAINT attendance_records_date_rep_unique UNIQUE (assistant, date)
);

CREATE INDEX IF NOT EXISTS idx_attendance_assistant ON public.attendance_records (assistant);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON public.attendance_records (date);
CREATE INDEX IF NOT EXISTS idx_attendance_status ON public.attendance_records (status);
CREATE INDEX IF NOT EXISTS idx_attendance_asst_date ON public.attendance_records (assistant, date);

-- attendance_settings: Company-wide policy configuration
CREATE TABLE IF NOT EXISTS public.attendance_settings (
  id                       TEXT PRIMARY KEY DEFAULT 'global_attendance_v1',
  company_name             TEXT DEFAULT 'Bihar AgTech Solutions Pvt. Ltd.',
  shift_start              TEXT DEFAULT '09:00',            -- HH:MM 24h
  shift_end                TEXT DEFAULT '18:00',            -- HH:MM 24h
  grace_period_minutes     INTEGER DEFAULT 30,              -- Late mark grace
  daily_base_wage          NUMERIC(10, 2) DEFAULT 650.00,  -- ₹ per payable day
  min_hours_full_day       FLOAT8 DEFAULT 7.5,             -- Hours for P status
  min_hours_half_day       FLOAT8 DEFAULT 4.0,             -- Hours for HD status
  bihar_gazetted_holidays  JSONB DEFAULT '[]'::jsonb,      -- Array of {date, name} objects
  employee_metadata        JSONB DEFAULT '{}'::jsonb,       -- emp codes, father names, etc.
  updated_by               TEXT DEFAULT 'admin',
  updated_at               TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- Insert default settings row
INSERT INTO public.attendance_settings (id) VALUES ('global_attendance_v1')
ON CONFLICT (id) DO NOTHING;

-- ─── ROW LEVEL SECURITY ─────────────────────────────────────────────────────

ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Public Read/Write Attendance Records"
    ON public.attendance_records FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Public Read/Write Attendance Settings"
    ON public.attendance_settings FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── REALTIME PUBLICATION ───────────────────────────────────────────────────

DO $$ BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_records;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_settings;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;


-- ============================================================================
-- LEAVE MANAGEMENT SYSTEM TABLES
-- Bihar AgTech Field Operations � Indian Labour Law Compliant
-- Policy: 12 PL + 12 CL + 12 SL per calendar year
-- ============================================================================

-- leave_applications: All leave requests from field representatives
CREATE TABLE IF NOT EXISTS public.leave_applications (
  id                   TEXT PRIMARY KEY,
  assistant            TEXT NOT NULL,
  emp_code             TEXT,
  hq                   TEXT,
  district             TEXT,
  leave_type           TEXT NOT NULL,
  leave_label          TEXT,
  from_date            DATE NOT NULL,
  to_date              DATE NOT NULL,
  days                 NUMERIC(4, 1) NOT NULL DEFAULT 1,
  half_day             BOOLEAN DEFAULT FALSE,
  session              TEXT DEFAULT 'full',
  reason               TEXT NOT NULL,
  status               TEXT NOT NULL DEFAULT 'Pending',
  applied_at           TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
  approved_by          TEXT,
  approved_at          TIMESTAMPTZ,
  manager_remarks      TEXT,
  created_at           TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
  updated_at           TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_leave_assistant ON public.leave_applications (assistant);
CREATE INDEX IF NOT EXISTS idx_leave_status ON public.leave_applications (status);
CREATE INDEX IF NOT EXISTS idx_leave_type ON public.leave_applications (leave_type);
CREATE INDEX IF NOT EXISTS idx_leave_asst_from ON public.leave_applications (assistant, from_date);

ALTER TABLE public.leave_applications ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Public Read/Write Leave Applications"
    ON public.leave_applications FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.leave_applications;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
