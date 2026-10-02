-- ==============================================================================
-- BIHAR TIER-A RETAILER OPERATIONS & SALES PIPELINE DATABASE SCHEMA
-- PostgreSQL + Row Level Security (RLS) Policies for Supabase
-- Fully Idempotent Migration Script (safe to run multiple times)
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. ENUMS & DOMAINS
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('manager', 'field_rep', 'auditor');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE visit_status AS ENUM ('Pending', 'Visited', 'Closed', 'Revisit_Required');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE payment_terms_type AS ENUM ('Cash_on_Delivery', 'Credit_15_Days', 'Credit_30_Days', 'Advance_Paid', 'PDC');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. ASSISTANTS & FIELD STATIONS TABLE
CREATE TABLE IF NOT EXISTS public.assistants (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
    name TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE,
    phone TEXT,
    hq TEXT NOT NULL,
    district TEXT NOT NULL,
    role user_role DEFAULT 'field_rep',
    target INTEGER DEFAULT 70,
    blocks TEXT[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- 4. RETAILERS (TIER-A COUNTERS) TABLE
CREATE TABLE IF NOT EXISTS public.retailers (
    id TEXT PRIMARY KEY,
    retailer TEXT NOT NULL,
    assistant TEXT REFERENCES public.assistants(name) ON UPDATE CASCADE ON DELETE SET NULL,
    hq TEXT NOT NULL,
    district TEXT NOT NULL,
    block TEXT NOT NULL,
    mobile TEXT,
    status TEXT DEFAULT 'Pending',
    potential_for TEXT,
    potential_sell TEXT,
    notes TEXT,
    verified_visit BOOLEAN DEFAULT FALSE,
    check_in_date DATE,
    check_in_time TEXT,
    check_in_lat DOUBLE PRECISION,
    check_in_lng DOUBLE PRECISION,
    check_in_accuracy DOUBLE PRECISION,
    check_in_dist_km DOUBLE PRECISION,
    check_in_map_url TEXT,
    check_in_rep TEXT,
    -- Commercial & Sales Pipeline Fields
    last_visit_date DATE,
    last_visit_time TEXT,
    follow_up_date DATE,
    follow_up_notes TEXT,
    total_orders_value NUMERIC(12, 2) DEFAULT 0.00,
    last_order_date DATE,
    updated_by TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- SAFE MIGRATION FOR PRE-EXISTING RETAILERS TABLE:
-- If public.retailers already existed before running this script, add missing columns:
ALTER TABLE public.retailers ADD COLUMN IF NOT EXISTS last_visit_date DATE;
ALTER TABLE public.retailers ADD COLUMN IF NOT EXISTS last_visit_time TEXT;
ALTER TABLE public.retailers ADD COLUMN IF NOT EXISTS follow_up_date DATE;
ALTER TABLE public.retailers ADD COLUMN IF NOT EXISTS follow_up_notes TEXT;
ALTER TABLE public.retailers ADD COLUMN IF NOT EXISTS total_orders_value NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE public.retailers ADD COLUMN IF NOT EXISTS last_order_date DATE;
ALTER TABLE public.retailers ADD COLUMN IF NOT EXISTS updated_by TEXT;
ALTER TABLE public.retailers ADD COLUMN IF NOT EXISTS verified_visit BOOLEAN DEFAULT FALSE;
ALTER TABLE public.retailers ADD COLUMN IF NOT EXISTS check_in_date DATE;
ALTER TABLE public.retailers ADD COLUMN IF NOT EXISTS check_in_time TEXT;
ALTER TABLE public.retailers ADD COLUMN IF NOT EXISTS check_in_lat DOUBLE PRECISION;
ALTER TABLE public.retailers ADD COLUMN IF NOT EXISTS check_in_lng DOUBLE PRECISION;
ALTER TABLE public.retailers ADD COLUMN IF NOT EXISTS check_in_accuracy DOUBLE PRECISION;
ALTER TABLE public.retailers ADD COLUMN IF NOT EXISTS check_in_dist_km DOUBLE PRECISION;
ALTER TABLE public.retailers ADD COLUMN IF NOT EXISTS check_in_map_url TEXT;
ALTER TABLE public.retailers ADD COLUMN IF NOT EXISTS check_in_rep TEXT;

-- 5. CHECK-IN LOGS & PHYSICAL VISIT AUDIT TABLE
CREATE TABLE IF NOT EXISTS public.check_in_logs (
    id TEXT PRIMARY KEY,
    retailer_id TEXT REFERENCES public.retailers(id) ON DELETE CASCADE,
    retailer TEXT NOT NULL,
    mobile TEXT,
    block TEXT NOT NULL,
    district TEXT NOT NULL,
    rep TEXT NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    time TEXT NOT NULL,
    timestamp BIGINT NOT NULL,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    accuracy DOUBLE PRECISION NOT NULL,
    dist_km DOUBLE PRECISION,
    map_url TEXT,
    status TEXT DEFAULT 'Visited',
    notes TEXT,
    has_shop_photo BOOLEAN DEFAULT FALSE,
    shop_photo_url TEXT,
    order_booked BOOLEAN DEFAULT FALSE,
    order_value NUMERIC(10, 2) DEFAULT 0.00,
    follow_up_date DATE,
    server_received_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- SAFE MIGRATION FOR PRE-EXISTING CHECK_IN_LOGS TABLE:
ALTER TABLE public.check_in_logs ADD COLUMN IF NOT EXISTS has_shop_photo BOOLEAN DEFAULT FALSE;
ALTER TABLE public.check_in_logs ADD COLUMN IF NOT EXISTS shop_photo_url TEXT;
ALTER TABLE public.check_in_logs ADD COLUMN IF NOT EXISTS order_booked BOOLEAN DEFAULT FALSE;
ALTER TABLE public.check_in_logs ADD COLUMN IF NOT EXISTS order_value NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE public.check_in_logs ADD COLUMN IF NOT EXISTS follow_up_date DATE;
ALTER TABLE public.check_in_logs ADD COLUMN IF NOT EXISTS server_received_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());

-- 6. COMMERCIAL SALES ORDERS TABLE (PIPELINE ENGINE)
CREATE TABLE IF NOT EXISTS public.orders (
    id TEXT PRIMARY KEY DEFAULT ('ord_' || uuid_generate_v4()::TEXT),
    retailer_id TEXT NOT NULL REFERENCES public.retailers(id) ON DELETE CASCADE,
    retailer_name TEXT NOT NULL,
    assistant TEXT NOT NULL,
    order_date DATE NOT NULL DEFAULT CURRENT_DATE,
    order_time TEXT,
    product_sku TEXT NOT NULL, -- e.g. 'Super Paddy 64', 'Pioneer Maize 3355'
    quantity_bags INTEGER NOT NULL CHECK (quantity_bags > 0),
    unit_price NUMERIC(10, 2) NOT NULL,
    total_order_value NUMERIC(12, 2) GENERATED ALWAYS AS (quantity_bags * unit_price) STORED,
    payment_terms payment_terms_type DEFAULT 'Cash_on_Delivery',
    advance_collected NUMERIC(10, 2) DEFAULT 0.00,
    delivery_due_date DATE,
    order_status TEXT DEFAULT 'Confirmed',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- 7. DEALER INVENTORY & OFFTAKE LIQUIDATION TABLE
CREATE TABLE IF NOT EXISTS public.dealer_stock (
    id TEXT PRIMARY KEY DEFAULT ('stk_' || uuid_generate_v4()::TEXT),
    retailer_id TEXT NOT NULL REFERENCES public.retailers(id) ON DELETE CASCADE,
    retailer_name TEXT NOT NULL,
    assistant TEXT NOT NULL,
    audit_date DATE NOT NULL DEFAULT CURRENT_DATE,
    company_stock_bags INTEGER DEFAULT 0,
    competitor_stock_bags INTEGER DEFAULT 0,
    competitor_brand TEXT,
    weekly_offtake_pace TEXT DEFAULT 'Moderate', -- Fast, Moderate, Slow, Nil
    liquidation_support_needed BOOLEAN DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- 8. DEMO PLOTS TABLE
CREATE TABLE IF NOT EXISTS public.demo_plots (
    id TEXT PRIMARY KEY,
    assistant TEXT NOT NULL,
    farmer_name TEXT NOT NULL,
    farmer_mobile TEXT,
    village TEXT NOT NULL,
    block TEXT NOT NULL,
    district TEXT NOT NULL,
    crop TEXT NOT NULL,
    hybrid_tested TEXT NOT NULL,
    competitor_check TEXT,
    sowing_date DATE,
    current_stage TEXT,
    yield_result_kg_acre NUMERIC(8, 2),
    observations TEXT,
    has_photo BOOLEAN DEFAULT FALSE,
    photo_url TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- SAFE MIGRATION FOR PRE-EXISTING DEMO_PLOTS TABLE:
ALTER TABLE public.demo_plots ADD COLUMN IF NOT EXISTS has_photo BOOLEAN DEFAULT FALSE;
ALTER TABLE public.demo_plots ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- 9. FARMER MEETINGS TABLE
CREATE TABLE IF NOT EXISTS public.farmer_meetings (
    id TEXT PRIMARY KEY,
    assistant TEXT NOT NULL,
    village TEXT NOT NULL,
    block TEXT NOT NULL,
    district TEXT NOT NULL,
    crop TEXT NOT NULL,
    topic TEXT NOT NULL,
    date DATE NOT NULL,
    time TEXT,
    farmers_count INTEGER DEFAULT 0,
    key_queries TEXT,
    retailer_invited TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- 10. ATTENDANCE & MUSTER ROLL TABLE
CREATE TABLE IF NOT EXISTS public.attendance_records (
    id TEXT PRIMARY KEY,
    assistant TEXT NOT NULL,
    date DATE NOT NULL,
    punch_in_time TEXT,
    punch_in_lat DOUBLE PRECISION,
    punch_in_lng DOUBLE PRECISION,
    punch_out_time TEXT,
    punch_out_lat DOUBLE PRECISION,
    punch_out_lng DOUBLE PRECISION,
    status TEXT DEFAULT 'P',
    total_hours NUMERIC(4, 2),
    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- 11. INDEXES FOR HIGH-THROUGHPUT FILTERING
CREATE INDEX IF NOT EXISTS idx_retailers_assistant ON public.retailers(assistant);
CREATE INDEX IF NOT EXISTS idx_retailers_block ON public.retailers(block);
CREATE INDEX IF NOT EXISTS idx_retailers_follow_up ON public.retailers(follow_up_date);
CREATE INDEX IF NOT EXISTS idx_check_ins_rep_date ON public.check_in_logs(rep, date);
CREATE INDEX IF NOT EXISTS idx_orders_rep ON public.orders(assistant, order_date);
CREATE INDEX IF NOT EXISTS idx_attendance_assistant_date ON public.attendance_records(assistant, date);

-- ==============================================================================
-- 12. ROW LEVEL SECURITY (RLS) POLICIES
-- Protects Dealer PII and prevents cross-rep data tampering
-- ==============================================================================

-- Enable RLS across all primary tables
ALTER TABLE public.retailers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.check_in_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dealer_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demo_plots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.farmer_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

-- Helper function: Check if current authenticated user has Manager role
CREATE OR REPLACE FUNCTION public.is_manager()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (
        auth.jwt() ->> 'role' = 'manager' OR
        (auth.jwt() -> 'user_metadata' ->> 'role') = 'manager' OR
        auth.jwt() ->> 'email' LIKE '%admin%'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- POLICY: RETAILERS
DROP POLICY IF EXISTS "Managers have full access to retailers" ON public.retailers;
CREATE POLICY "Managers have full access to retailers"
ON public.retailers
FOR ALL
TO authenticated
USING (public.is_manager());

DROP POLICY IF EXISTS "Field reps can view and update assigned retailers" ON public.retailers;
CREATE POLICY "Field reps can view and update assigned retailers"
ON public.retailers
FOR SELECT
TO authenticated
USING (
    assistant = (auth.jwt() -> 'user_metadata' ->> 'rep_name') OR
    assistant = (auth.jwt() ->> 'email') OR
    public.is_manager()
);

DROP POLICY IF EXISTS "Field reps can update assigned retailers" ON public.retailers;
CREATE POLICY "Field reps can update assigned retailers"
ON public.retailers
FOR UPDATE
TO authenticated
USING (
    assistant = (auth.jwt() -> 'user_metadata' ->> 'rep_name') OR
    public.is_manager()
)
WITH CHECK (
    assistant = (auth.jwt() -> 'user_metadata' ->> 'rep_name') OR
    public.is_manager()
);

-- POLICY: CHECK-IN LOGS
DROP POLICY IF EXISTS "Reps can insert their own check-ins" ON public.check_in_logs;
CREATE POLICY "Reps can insert their own check-ins"
ON public.check_in_logs
FOR INSERT
TO authenticated
WITH CHECK (
    rep = (auth.jwt() -> 'user_metadata' ->> 'rep_name') OR
    public.is_manager()
);

DROP POLICY IF EXISTS "View check-in logs" ON public.check_in_logs;
CREATE POLICY "View check-in logs"
ON public.check_in_logs
FOR SELECT
TO authenticated
USING (
    rep = (auth.jwt() -> 'user_metadata' ->> 'rep_name') OR
    public.is_manager()
);

-- POLICY: ORDERS
DROP POLICY IF EXISTS "Field reps can manage their orders" ON public.orders;
CREATE POLICY "Field reps can manage their orders"
ON public.orders
FOR ALL
TO authenticated
USING (
    assistant = (auth.jwt() -> 'user_metadata' ->> 'rep_name') OR
    public.is_manager()
)
WITH CHECK (
    assistant = (auth.jwt() -> 'user_metadata' ->> 'rep_name') OR
    public.is_manager()
);
