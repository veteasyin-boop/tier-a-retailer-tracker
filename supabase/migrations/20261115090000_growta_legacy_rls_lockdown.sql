-- Close legacy direct Data API access to operational tables.
-- The Growta API uses the server-only service role and enforces tenant/scope filters.
-- Keep legacy data intact. The historical tables may not exist in a clean bootstrap DB,
-- so hardening is conditional and remains safe on both clean and upgraded installations.

DO $$
DECLARE
  policy_row record;
  target_table text;
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

  FOREACH target_table IN ARRAY ARRAY['retailers', 'check_in_logs', 'orders']
  LOOP
    IF to_regclass(format('public.%I', target_table)) IS NOT NULL THEN
      EXECUTE format(
        'REVOKE ALL PRIVILEGES ON TABLE public.%I FROM anon, authenticated',
        target_table
      );
      EXECUTE format(
        'COMMENT ON TABLE public.%I IS %L',
        target_table,
        'Legacy operational data. Browser roles have no direct privileges; access through tenant-scoped API.'
      );
    END IF;
  END LOOP;
END
$$;

-- This function trusted editable user_metadata, an email substring, and SECURITY DEFINER.
-- Policies on the legacy operational tables have been removed above.
DROP FUNCTION IF EXISTS public.is_manager();
