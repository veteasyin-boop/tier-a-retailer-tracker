-- Local/dev bootstrap snapshot of the existing Growta core schema.
-- Source of truth: database/schema/001_core_multi_tenant_schema.sql
-- and database/seeds/001_bihar_initial_seed.sql.
-- Additive and conflict-safe: does not drop, truncate, or rewrite existing rows.

BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    tier VARCHAR(50) DEFAULT 'Enterprise',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL,
    parent_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
    state VARCHAR(100) NOT NULL DEFAULT 'Bihar',
    country VARCHAR(100) NOT NULL DEFAULT 'India',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_tenant_org_code UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS public.territories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    hq_name VARCHAR(100) NOT NULL,
    district VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL DEFAULT 'Bihar',
    allocated_blocks JSONB DEFAULT '[]'::jsonb,
    center_lat DOUBLE PRECISION,
    center_lng DOUBLE PRECISION,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_tenant_hq UNIQUE (tenant_id, hq_name)
);

CREATE TABLE IF NOT EXISTS public.roles (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.permissions (
    id VARCHAR(100) PRIMARY KEY,
    category VARCHAR(50) NOT NULL,
    description TEXT
);

CREATE TABLE IF NOT EXISTS public.role_permissions (
    role_id VARCHAR(50) REFERENCES public.roles(id) ON DELETE CASCADE,
    permission_id VARCHAR(100) REFERENCES public.permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
    territory_id UUID REFERENCES public.territories(id) ON DELETE SET NULL,
    email VARCHAR(255) UNIQUE,
    phone VARCHAR(20),
    full_name VARCHAR(255) NOT NULL,
    emp_code VARCHAR(50),
    role VARCHAR(50) NOT NULL REFERENCES public.roles(id) DEFAULT 'FIELD_OFFICER',
    password_hash VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    user_name VARCHAR(255),
    user_role VARCHAR(50),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id VARCHAR(255) NOT NULL,
    old_data JSONB,
    new_data JSONB,
    diff JSONB,
    ip_address VARCHAR(50),
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_tenant_action ON public.audit_logs(tenant_id, action);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON public.audit_logs(created_at DESC);

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.territories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Preserve the legacy policies from the original core schema for parity.
-- They are not the authorization mechanism for new Growta membership tables.
DO $policies$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'tenants' AND policyname = 'tenant_isolation_tenants') THEN
    CREATE POLICY tenant_isolation_tenants ON public.tenants
      FOR ALL USING (id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'organizations' AND policyname = 'tenant_isolation_organizations') THEN
    CREATE POLICY tenant_isolation_organizations ON public.organizations
      FOR ALL USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'territories' AND policyname = 'tenant_isolation_territories') THEN
    CREATE POLICY tenant_isolation_territories ON public.territories
      FOR ALL USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'users' AND policyname = 'tenant_isolation_users') THEN
    CREATE POLICY tenant_isolation_users ON public.users
      FOR ALL USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'audit_logs' AND policyname = 'tenant_isolation_audit') THEN
    CREATE POLICY tenant_isolation_audit ON public.audit_logs
      FOR ALL USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
  END IF;
END;
$policies$;

INSERT INTO public.roles (id, name, description) VALUES
('SUPER_ADMIN', 'Super Administrator', 'Full platform access across all organizations and system governance'),
('STATE_HEAD', 'State Sales Manager', 'Full supervisory access across all state territories, approvals, and audits'),
('TERRITORY_MANAGER', 'Territory Sales Executive', 'Supervisory access over designated headquarters and assigned field reps'),
('FIELD_OFFICER', 'Field Operations Officer', 'Frontline field force execution for dealer visits, orders, and farmer CRM')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.permissions (id, category, description) VALUES
('retailer.read', 'Retailer', 'View retailer directory, profiles, and history'),
('retailer.create', 'Retailer', 'Register a new retailer into the counter registry'),
('retailer.update', 'Retailer', 'Update retailer profile, credit status, and notes'),
('retailer.reassign', 'Retailer', 'Reassign retailer territory or assistant'),
('retailer.export', 'Retailer', 'Export retailer rosters to Excel/CSV'),
('visit.checkin', 'Field Ops', 'Execute verified GPS check-in at retailer counter'),
('visit.review', 'Field Ops', 'Audit and review field check-in evidence and photos'),
('order.create', 'Commercial', 'Book commercial orders at dealer counter'),
('order.approve', 'Commercial', 'Approve orders and dispatch instructions'),
('attendance.punch', 'Workforce', 'Punch in and punch out for daily shift'),
('attendance.regularize', 'Workforce', 'Request shift regularization'),
('attendance.approve', 'Workforce', 'Approve regularization and muster roll entries'),
('tada.claim', 'Workforce', 'Submit travel allowance and DA claims'),
('tada.approve', 'Workforce', 'Audit and approve fuel and travel claims'),
('leave.apply', 'Workforce', 'Submit leave applications'),
('leave.approve', 'Workforce', 'Approve or reject statutory leave requests'),
('inventory.read', 'Supply Chain', 'Inspect depot inventory and allocation ledgers'),
('inventory.issue', 'Supply Chain', 'Issue demo kits and promotional stock to reps'),
('inventory.reconcile', 'Supply Chain', 'Perform weekly physical stock reconciliation'),
('kpi.configure', 'Performance', 'Configure MGO 100-point KPI metrics and weightages'),
('sop.manage', 'Performance', 'Manage 10-step daily operating rhythm protocols'),
('ai.query', 'Intelligence', 'Consult NeuronCore AI copilot for natural language analytics')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 'FIELD_OFFICER', id FROM public.permissions
WHERE id IN (
  'retailer.read', 'visit.checkin', 'order.create', 'attendance.punch',
  'attendance.regularize', 'tada.claim', 'leave.apply', 'inventory.read', 'ai.query'
)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 'STATE_HEAD', id FROM public.permissions
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 'SUPER_ADMIN', id FROM public.permissions
ON CONFLICT DO NOTHING;

INSERT INTO public.tenants (id, name, slug, tier, is_active) VALUES
('a0000000-0000-0000-0000-000000000001', 'Varyanta Global Industries', 'varyanta-global', 'Enterprise', true)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.organizations (id, tenant_id, name, code, state, country, is_active) VALUES
('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
 'Bihar State Agricultural Operations', 'GROWTA-BIHAR-OPS', 'Bihar', 'India', true)
ON CONFLICT (tenant_id, code) DO NOTHING;

INSERT INTO public.territories
  (tenant_id, organization_id, hq_name, district, state, allocated_blocks, center_lat, center_lng)
VALUES
('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Bihta', 'Patna', 'Bihar', '["Bihta", "Maner", "Naubatpur"]'::jsonb, 25.5658, 84.8694),
('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Danapur', 'Patna', 'Bihar', '["Danapur", "Phulwari Sharif", "Dinapur-Cum-Khagaul"]'::jsonb, 25.6322, 85.0444),
('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Masaurhi', 'Patna', 'Bihar', '["Masaurhi", "Punpun", "Dhanarua"]'::jsonb, 25.3512, 85.0298),
('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Fatuha', 'Patna', 'Bihar', '["Fatuha", "Daniyawan", "Sampatchak"]'::jsonb, 25.5186, 85.3120),
('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Bakhtiarpur', 'Patna', 'Bihar', '["Bakhtiarpur", "Khusrupur", "Athmalgola"]'::jsonb, 25.4578, 85.5262),
('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Barh', 'Patna', 'Bihar', '["Barh", "Belchhi", "Pandarak"]'::jsonb, 25.4800, 85.7100),
('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Mokama', 'Patna', 'Bihar', '["Mokama", "Ghoswari"]'::jsonb, 25.3980, 85.9220),
('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Paliganj', 'Patna', 'Bihar', '["Paliganj", "Bikram", "Dulhin Bazar"]'::jsonb, 25.3280, 84.8010)
ON CONFLICT (tenant_id, hq_name) DO NOTHING;

COMMIT;
