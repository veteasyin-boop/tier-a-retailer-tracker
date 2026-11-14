-- Remove permissive legacy policies that allow unrestricted reads/writes.
-- Operational data is accessed through the tenant/scope-aware API using server-only credentials.
DO $$
DECLARE
  policy_row record;
BEGIN
  FOR policy_row IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND 'public' = ANY(roles)
      AND (
        coalesce(qual, '') = 'true'
        OR coalesce(with_check, '') = 'true'
      )
  LOOP
    EXECUTE format(
      'DROP POLICY %I ON %I.%I',
      policy_row.policyname,
      policy_row.schemaname,
      policy_row.tablename
    );
  END LOOP;
END
$$;

-- These tables intentionally have no browser-facing policies after lockdown.
-- RLS remains enabled; the trusted API uses service_role and must apply tenant/scope predicates.
