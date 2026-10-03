-- =========================================================================
-- GROWTA ENTERPRISE: CATALOG, ORDERS & INVENTORY LEDGER SCHEMA (COMPATIBLE)
-- Authority: GROWTA-MASTER-PRD-001 (Sections 31, 32, 33, 34 — Modules 12, 13, 14, 15)
-- Database: PostgreSQL 15+ with Multi-Tenant RLS & String/UUID ID Compatibility
-- =========================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. PRODUCTS & SKUS MASTER
CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id TEXT NOT NULL DEFAULT 'a0000000-0000-0000-0000-000000000001',
    product_name VARCHAR(255) NOT NULL,
    brand VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL, -- 'Seed' | 'Crop Protection' | 'Crop Nutrition'
    crop VARCHAR(100) NOT NULL,
    variety VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_tenant_product UNIQUE(tenant_id, product_name)
);

CREATE TABLE IF NOT EXISTS skus (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id TEXT NOT NULL DEFAULT 'a0000000-0000-0000-0000-000000000001',
    product_id TEXT REFERENCES products(id) ON DELETE CASCADE,
    sku_code VARCHAR(100) NOT NULL,
    pack_size VARCHAR(50) NOT NULL,
    unit VARCHAR(20) NOT NULL, -- 'Bag', 'Bottle', 'Pouch'
    dealer_price NUMERIC(12, 2) NOT NULL,
    mrp NUMERIC(12, 2) NOT NULL,
    gst_rate NUMERIC(5, 2) DEFAULT 0.00,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_tenant_sku_code UNIQUE(tenant_id, sku_code)
);

-- 2. DEPOTS & WAREHOUSES
CREATE TABLE IF NOT EXISTS warehouses (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id TEXT NOT NULL DEFAULT 'a0000000-0000-0000-0000-000000000001',
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    location TEXT,
    district VARCHAR(100) NOT NULL DEFAULT 'Patna',
    state VARCHAR(100) NOT NULL DEFAULT 'Bihar',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_tenant_warehouse_code UNIQUE(tenant_id, code)
);

-- 3. INVENTORY DOUBLE-ENTRY LEDGER
CREATE TABLE IF NOT EXISTS inventory_ledgers (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id TEXT NOT NULL DEFAULT 'a0000000-0000-0000-0000-000000000001',
    warehouse_id TEXT REFERENCES warehouses(id) ON DELETE RESTRICT,
    sku_id TEXT NOT NULL REFERENCES skus(id) ON DELETE RESTRICT,
    batch_no VARCHAR(100),
    movement_type VARCHAR(50) NOT NULL, -- 'OPENING_BALANCE', 'DEPOT_RECEIPT', 'ISSUE_TO_REP', 'RETURN_FROM_REP', 'DEALER_LIQUIDATION'
    quantity NUMERIC(12, 2) NOT NULL,
    unit_cost NUMERIC(12, 2),
    total_value NUMERIC(14, 2),
    source VARCHAR(255),
    destination VARCHAR(255),
    assistant_name VARCHAR(100),
    retailer_id TEXT,
    recorded_by VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ledger_sku ON inventory_ledgers(tenant_id, sku_id);
CREATE INDEX IF NOT EXISTS idx_ledger_warehouse ON inventory_ledgers(tenant_id, warehouse_id);

-- 4. COMMERCIAL SALES ORDERS (TEXT ID COMPATIBLE)
CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY DEFAULT ('ord_' || round(extract(epoch from now()))::text || '_' || substr(md5(random()::text), 1, 6)),
    tenant_id TEXT NOT NULL DEFAULT 'a0000000-0000-0000-0000-000000000001',
    retailer_id TEXT NOT NULL,
    retailer_name VARCHAR(255) NOT NULL,
    assistant_name VARCHAR(100) NOT NULL,
    order_date DATE NOT NULL DEFAULT CURRENT_DATE,
    order_status VARCHAR(50) NOT NULL DEFAULT 'Submitted',
    subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    discount_amount NUMERIC(12, 2) DEFAULT 0.00,
    gst_amount NUMERIC(12, 2) DEFAULT 0.00,
    grand_total NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    payment_terms VARCHAR(50) DEFAULT 'Cash_on_Delivery',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_items (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    sku_id TEXT REFERENCES skus(id) ON DELETE RESTRICT,
    product_name VARCHAR(255) NOT NULL,
    pack_size VARCHAR(50),
    quantity NUMERIC(10, 2) NOT NULL,
    unit_price NUMERIC(12, 2) NOT NULL,
    line_total NUMERIC(12, 2) NOT NULL
);

-- Row-Level Security
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE skus ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_ledgers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Default permissive read/write policies for authenticated reps and anon sync
CREATE POLICY IF NOT EXISTS p_products_all ON products FOR ALL USING (true);
CREATE POLICY IF NOT EXISTS p_skus_all ON skus FOR ALL USING (true);
CREATE POLICY IF NOT EXISTS p_warehouses_all ON warehouses FOR ALL USING (true);
CREATE POLICY IF NOT EXISTS p_inventory_all ON inventory_ledgers FOR ALL USING (true);
CREATE POLICY IF NOT EXISTS p_orders_all ON orders FOR ALL USING (true);
CREATE POLICY IF NOT EXISTS p_order_items_all ON order_items FOR ALL USING (true);
