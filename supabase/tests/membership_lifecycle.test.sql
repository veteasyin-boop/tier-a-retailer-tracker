-- Membership lifecycle status transitions and audit.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path TO public,extensions;
SELECT plan(4);
INSERT INTO public.tenants(id,name,slug,tier,is_active)
VALUES ('a8000000-0000-4000-8000-000000000001','Membership Lifecycle Tenant','membership-life-test','Test',true);
INSERT INTO auth.users(id,email) VALUES
 ('c8000000-0000-4000-8000-000000000001','membership-admin@example.test'),
 ('c8000000-0000-4000-8000-000000000002','membership-target@example.test');
INSERT INTO public.memberships(id,tenant_id,user_id,status) VALUES
 ('d8000000-0000-4000-8000-000000000001','a8000000-0000-4000-8000-000000000001','c8000000-0000-4000-8000-000000000001','active'),
 ('d8000000-0000-4000-8000-000000000002','a8000000-0000-4000-8000-000000000001','c8000000-0000-4000-8000-000000000002','invited');
INSERT INTO public.growta_permissions(code,category,description)
VALUES ('membership.manage','Identity','Manage memberships') ON CONFLICT(code) DO NOTHING;
INSERT INTO public.tenant_roles(id,tenant_id,code,name)
VALUES ('e8000000-0000-4000-8000-000000000001','a8000000-0000-4000-8000-000000000001','MEMBERSHIP_ADMIN','Membership Admin');
INSERT INTO public.tenant_role_permissions(tenant_id,role_id,permission_code)
VALUES ('a8000000-0000-4000-8000-000000000001','e8000000-0000-4000-8000-000000000001','membership.manage');
INSERT INTO public.membership_roles(tenant_id,membership_id,role_id)
VALUES ('a8000000-0000-4000-8000-000000000001','d8000000-0000-4000-8000-000000000001','e8000000-0000-4000-8000-000000000001');
SET LOCAL ROLE service_role;
SELECT public.update_tenant_membership_status('a8000000-0000-4000-8000-000000000001',
 'c8000000-0000-4000-8000-000000000001','membership-activate-test',
 'd8000000-0000-4000-8000-000000000002','active');
SELECT is((SELECT status FROM public.memberships WHERE id='d8000000-0000-4000-8000-000000000002'),
 'active','invited membership can be activated');
SELECT ok((SELECT accepted_at IS NOT NULL FROM public.memberships WHERE id='d8000000-0000-4000-8000-000000000002'),
 'activation records acceptance timestamp');
SELECT is((SELECT count(*)::int FROM public.growta_audit_events
 WHERE tenant_id='a8000000-0000-4000-8000-000000000001'
 AND action='membership.activated' AND request_id='membership-activate-test'),1,
 'membership activation is audited atomically');
SELECT throws_ok($$ SELECT public.update_tenant_membership_status(
 'a8000000-0000-4000-8000-000000000001','c8000000-0000-4000-8000-000000000001',
 'membership-self-suspend','d8000000-0000-4000-8000-000000000001','suspended') $$,
 '55000','Self-suspension is not allowed','actor cannot suspend own membership');
RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
