-- Close legacy direct Data API access to operational tables.
-- The Growta API uses the server-only service role and enforces tenant/scope filters.
-- Keep the legacy data intact; this migration only removes unsafe browser-facing policies/grants.

DO $$
DECLARE
  policy_row record;
BEGIN
  FOR policy_row IN
    SELECT tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('retailers', 'check_in_logs', 'orders')
  LOOP
    EXECUTE format(
      'DROP POLICY %I ON public.%I',
      policy_row.policyname,
      policy_row.tablename
    );
  END LOOP;
END
$$;

REVOKE ALL PRIVILEGES ON TABLE
  public.retailers,
  public.check_in_logs,
  public.orders
FROM anon, authenticated;

-- This function trusted editable user_metadata, an email substring, and SECURITY DEFINER.
-- All policies depending on it have been removed above.
DROP FUNCTION IF EXISTS public.is_manager();

COMMENT ON TABLE public.retailers IS
  'Legacy operational data. Browser roles have no direct privileges; access through tenant-scoped API.';
COMMENT ON TABLE public.check_in_logs IS
  'Legacy operational data. Browser roles have no direct privileges; access through tenant-scoped API.';
COMMENT ON TABLE public.orders IS
  'Legacy operational data. Browser roles have no direct privileges; access through tenant-scoped API.';
