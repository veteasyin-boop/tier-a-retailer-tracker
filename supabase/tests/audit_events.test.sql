-- Growta append-only audit event access tests.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path TO public, extensions;

SELECT plan(6);

INSERT INTO public.tenants (id, name, slug, tier, is_active) VALUES
  ('a3000000-0000-4000-8000-000000000001', 'Audit Test Tenant', 'audit-test', 'Test', true);
INSERT INTO auth.users (id, email) VALUES
  ('c3000000-0000-4000-8000-000000000001', 'audit-user@example.test');

SELECT ok((
  SELECT c.relrowsecurity
  FROM pg_class AS c
  WHERE c.oid = 'public.growta_audit_events'::regclass
), 'RLS enabled on audit event table');

SELECT ok(
  NOT has_table_privilege('authenticated', 'public.growta_audit_events', 'SELECT')
  AND NOT has_table_privilege('authenticated', 'public.growta_audit_events', 'INSERT'),
  'authenticated browser role cannot read or write audit events directly'
);

SELECT ok(
  has_table_privilege('service_role', 'public.growta_audit_events', 'SELECT')
  AND has_table_privilege('service_role', 'public.growta_audit_events', 'INSERT'),
  'service role can read and append audit events'
);

SELECT ok(
  NOT has_table_privilege('service_role', 'public.growta_audit_events', 'UPDATE')
  AND NOT has_table_privilege('service_role', 'public.growta_audit_events', 'DELETE'),
  'service role cannot update or delete audit events'
);

SET LOCAL ROLE service_role;
INSERT INTO public.growta_audit_events (
  tenant_id, actor_user_id, request_id, action, entity_type, entity_id, metadata
) VALUES (
  'a3000000-0000-4000-8000-000000000001',
  'c3000000-0000-4000-8000-000000000001',
  'req-audit-test',
  'test.appended',
  'test',
  'entity-1',
  '{"source":"pgTAP"}'::jsonb
);
SELECT is(
  (SELECT count(*)::int FROM public.growta_audit_events WHERE request_id = 'req-audit-test'),
  1,
  'service role can append tenant audit event'
);
RESET ROLE;

SELECT ok(
  EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_growta_audit_tenant_created'),
  'audit events have tenant/time index for paginated reads'
);

SELECT * FROM finish();
ROLLBACK;
