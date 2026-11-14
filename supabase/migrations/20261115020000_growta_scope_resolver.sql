-- Server-side scope expansion avoids loading every tenant org unit per API request.
BEGIN;

CREATE OR REPLACE FUNCTION public.resolve_membership_org_unit_scope(
  p_tenant_id UUID,
  p_membership_id UUID
)
RETURNS TABLE (org_unit_id UUID)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  WITH RECURSIVE roots AS (
    SELECT s.org_unit_id, s.include_descendants
    FROM public.membership_org_unit_scopes AS s
    JOIN public.memberships AS m
      ON m.tenant_id = s.tenant_id
     AND m.id = s.membership_id
     AND m.status = 'active'
    JOIN public.tenants AS t
      ON t.id = m.tenant_id
     AND t.is_active IS TRUE
    WHERE s.tenant_id = p_tenant_id
      AND s.membership_id = p_membership_id
  ),
  expanded(id, root_id, include_descendants) AS (
    SELECT r.org_unit_id, r.org_unit_id, r.include_descendants
    FROM roots AS r
    UNION
    SELECT child.id, expanded.root_id, expanded.include_descendants
    FROM public.org_units AS child
    JOIN expanded ON child.parent_id = expanded.id
    WHERE child.tenant_id = p_tenant_id
      AND expanded.include_descendants IS TRUE
      AND child.is_active IS TRUE
  )
  SELECT DISTINCT expanded.id
  FROM expanded
  JOIN public.org_units AS u
    ON u.tenant_id = p_tenant_id
   AND u.id = expanded.id
   AND u.is_active IS TRUE;
$function$;

REVOKE ALL ON FUNCTION public.resolve_membership_org_unit_scope(UUID, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_membership_org_unit_scope(UUID, UUID)
  TO service_role;

COMMIT;
