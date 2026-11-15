-- Atomic membership placement and reporting mutation tests.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path TO public, extensions;
SELECT plan(5);

INSERT INTO public.tenants(id,name,slug,tier,is_active)
VALUES ('aa110000-0000-4000-8000-000000000001','Atomic Assignment Test','atomic-assignment-test','Test',true);

INSERT INTO auth.users(id,email) VALUES
 ('cc110000-0000-4000-8000-000000000001','atomic-admin@example.test'),
 ('cc110000-0000-4000-8000-000000000002','atomic-target@example.test'),
 ('cc110000-0000-4000-8000-000000000003','atomic-manager@example.test'),
 ('cc110000-0000-4000-8000-000000000004','atomic-second-target@example.test');

INSERT INTO public.memberships(id,tenant_id,user_id,status) VALUES
 ('dd110000-0000-4000-8000-000000000001','aa110000-0000-4000-8000-000000000001','cc110000-0000-4000-8000-000000000001','active'),
 ('dd110000-0000-4000-8000-000000000002','aa110000-0000-4000-8000-000000000001','cc110000-0000-4000-8000-000000000002','active'),
 ('dd110000-0000-4000-8000-000000000003','aa110000-0000-4000-8000-000000000001','cc110000-0000-4000-8000-000000000003','active'),
 ('dd110000-0000-4000-8000-000000000004','aa110000-0000-4000-8000-000000000001','cc110000-0000-4000-8000-000000000004','active');

INSERT INTO public.growta_permissions(code,category,description) VALUES
 ('membership.manage','Identity','Manage memberships'),
 ('reporting.manage','Identity','Manage reporting')
ON CONFLICT(code) DO NOTHING;

INSERT INTO public.tenant_roles(id,tenant_id,code,name) VALUES
 ('ee110000-0000-4000-8000-000000000001','aa110000-0000-4000-8000-000000000001','ATOMIC_ADMIN','Atomic Admin');

INSERT INTO public.tenant_role_permissions(tenant_id,role_id,permission_code) VALUES
 ('aa110000-0000-4000-8000-000000000001','ee110000-0000-4000-8000-000000000001','membership.manage'),
 ('aa110000-0000-4000-8000-000000000001','ee110000-0000-4000-8000-000000000001','reporting.manage');

INSERT INTO public.membership_roles(tenant_id,membership_id,role_id)
VALUES ('aa110000-0000-4000-8000-000000000001','dd110000-0000-4000-8000-000000000001','ee110000-0000-4000-8000-000000000001');

INSERT INTO public.org_unit_types(id,tenant_id,code,name) VALUES
 ('ff110000-0000-4000-8000-000000000001','aa110000-0000-4000-8000-000000000001','BRANCH','Branch');

INSERT INTO public.org_units(id,tenant_id,unit_type_id,code,name) VALUES
 ('ab110000-0000-4000-8000-000000000001','aa110000-0000-4000-8000-000000000001','ff110000-0000-4000-8000-000000000001','UNIT-A','Unit A'),
 ('ab110000-0000-4000-8000-000000000002','aa110000-0000-4000-8000-000000000001','ff110000-0000-4000-8000-000000000001','UNIT-B','Unit B');

INSERT INTO public.membership_org_assignments(tenant_id,membership_id,org_unit_id)
VALUES ('aa110000-0000-4000-8000-000000000001','dd110000-0000-4000-8000-000000000002','ab110000-0000-4000-8000-000000000001');

-- Manager B already reports to target A. Assigning A to report to B must fail.
INSERT INTO public.membership_reporting_relationships(tenant_id,membership_id,reports_to_membership_id,relationship_type)
VALUES ('aa110000-0000-4000-8000-000000000001','dd110000-0000-4000-8000-000000000003','dd110000-0000-4000-8000-000000000002','primary');

SET LOCAL ROLE service_role;

SELECT public.set_tenant_member_org_and_reporting(
 'aa110000-0000-4000-8000-000000000001',
 'cc110000-0000-4000-8000-000000000001',
 'atomic-success',
 'dd110000-0000-4000-8000-000000000004',
 'ab110000-0000-4000-8000-000000000002',
 NULL,
 'dd110000-0000-4000-8000-000000000003',
 'primary'
);

SELECT is(
 (SELECT org_unit_id FROM public.membership_org_assignments
  WHERE tenant_id='aa110000-0000-4000-8000-000000000001'
    AND membership_id='dd110000-0000-4000-8000-000000000004'),
 'ab110000-0000-4000-8000-000000000002'::uuid,
 'organization assignment commits'
);

SELECT is(
 (SELECT reports_to_membership_id FROM public.membership_reporting_relationships
  WHERE tenant_id='aa110000-0000-4000-8000-000000000001'
    AND membership_id='dd110000-0000-4000-8000-000000000004'
    AND relationship_type='primary' AND ends_at IS NULL),
 'dd110000-0000-4000-8000-000000000003'::uuid,
 'reporting relationship commits in the same transaction'
);

SELECT is(
 (SELECT count(*)::int FROM public.growta_audit_events
  WHERE tenant_id='aa110000-0000-4000-8000-000000000001'
    AND request_id='atomic-success'
    AND action='membership.organization_and_reporting_assigned'),
 1,
 'combined mutation writes one atomic audit event'
);

SELECT throws_ok(
 $$ SELECT public.set_tenant_member_org_and_reporting(
  'aa110000-0000-4000-8000-000000000001',
  'cc110000-0000-4000-8000-000000000001',
  'atomic-cycle-rejected',
  'dd110000-0000-4000-8000-000000000002',
  'ab110000-0000-4000-8000-000000000002',
  NULL,
  'dd110000-0000-4000-8000-000000000003',
  'primary'
 ) $$,
 '23514',
 'Primary reporting relationships cannot contain a cycle',
 'cycle rejection aborts the complete assignment transaction'
);

SELECT is(
 (SELECT org_unit_id FROM public.membership_org_assignments
  WHERE tenant_id='aa110000-0000-4000-8000-000000000001'
    AND membership_id='dd110000-0000-4000-8000-000000000002'),
 'ab110000-0000-4000-8000-000000000001'::uuid,
 'failed reporting update rolls back the preceding organization assignment'
);

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
