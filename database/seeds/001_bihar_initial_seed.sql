-- =========================================================================
-- GROWTA ENTERPRISE SEED DATA — ROLES, PERMISSIONS & BIHAR HQS
-- Document Authority: GROWTA-MASTER-PRD-001
-- =========================================================================

-- 1. Standard Roles
INSERT INTO roles (id, name, description) VALUES
('SUPER_ADMIN', 'Super Administrator', 'Full platform access across all organizations and system governance'),
('STATE_HEAD', 'State Sales Manager', 'Full supervisory access across all state territories, approvals, and audits'),
('TERRITORY_MANAGER', 'Territory Sales Executive', 'Supervisory access over designated headquarters and assigned field reps'),
('FIELD_OFFICER', 'Field Operations Officer', 'Frontline field force execution for dealer visits, orders, and farmer CRM')
ON CONFLICT (id) DO NOTHING;

-- 2. Standard Permissions
INSERT INTO permissions (id, category, description) VALUES
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

-- 3. Role Permissions Mappings
-- FIELD_OFFICER permissions
INSERT INTO role_permissions (role_id, permission_id) VALUES
('FIELD_OFFICER', 'retailer.read'),
('FIELD_OFFICER', 'visit.checkin'),
('FIELD_OFFICER', 'order.create'),
('FIELD_OFFICER', 'attendance.punch'),
('FIELD_OFFICER', 'attendance.regularize'),
('FIELD_OFFICER', 'tada.claim'),
('FIELD_OFFICER', 'leave.apply'),
('FIELD_OFFICER', 'inventory.read'),
('FIELD_OFFICER', 'ai.query')
ON CONFLICT DO NOTHING;

-- STATE_HEAD & SUPER_ADMIN get all permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT 'STATE_HEAD', id FROM permissions
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT 'SUPER_ADMIN', id FROM permissions
ON CONFLICT DO NOTHING;

-- 4. Initial Tenant: Varyanta Global Industries (Growta Bihar Ops)
INSERT INTO tenants (id, name, slug, tier, is_active) VALUES
('a0000000-0000-0000-0000-000000000001', 'Varyanta Global Industries', 'varyanta-global', 'Enterprise', true)
ON CONFLICT (slug) DO NOTHING;

-- 5. Initial State Organization
INSERT INTO organizations (id, tenant_id, name, code, state, country, is_active) VALUES
('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Bihar State Agricultural Operations', 'GROWTA-BIHAR-OPS', 'Bihar', 'India', true)
ON CONFLICT (tenant_id, code) DO NOTHING;

-- 6. 8 Bihar Operational HQs
INSERT INTO territories (tenant_id, organization_id, hq_name, district, state, allocated_blocks, center_lat, center_lng) VALUES
('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Bihta', 'Patna', 'Bihar', '["Bihta", "Maner", "Naubatpur"]'::jsonb, 25.5658, 84.8694),
('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Danapur', 'Patna', 'Bihar', '["Danapur", "Phulwari Sharif", "Dinapur-Cum-Khagaul"]'::jsonb, 25.6322, 85.0444),
('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Masaurhi', 'Patna', 'Bihar', '["Masaurhi", "Punpun", "Dhanarua"]'::jsonb, 25.3512, 85.0298),
('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Fatuha', 'Patna', 'Bihar', '["Fatuha", "Daniyawan", "Sampatchak"]'::jsonb, 25.5186, 85.3120),
('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Bakhtiarpur', 'Patna', 'Bihar', '["Bakhtiarpur", "Khusrupur", "Athmalgola"]'::jsonb, 25.4578, 85.5262),
('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Barh', 'Patna', 'Bihar', '["Barh", "Belchhi", "Pandarak"]'::jsonb, 25.4800, 85.7100),
('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Mokama', 'Patna', 'Bihar', '["Mokama", "Ghoswari"]'::jsonb, 25.3980, 85.9220),
('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Paliganj', 'Patna', 'Bihar', '["Paliganj", "Bikram", "Dulhin Bazar"]'::jsonb, 25.3280, 84.8010)
ON CONFLICT (tenant_id, hq_name) DO NOTHING;
