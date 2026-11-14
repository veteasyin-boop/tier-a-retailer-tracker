-- RLS policy subqueries must not directly read tenants: legacy tenant RLS
-- depends on app.current_tenant_id. Use the SECURITY DEFINER membership helper,
-- which verifies both active membership and active tenant without recursion.
BEGIN;

DROP POLICY IF EXISTS membership_roles_select_self ON public.membership_roles;
CREATE POLICY membership_roles_select_self ON public.membership_roles
  FOR SELECT TO authenticated
  USING (
    private.has_tenant_membership(tenant_id)
    AND EXISTS (
      SELECT 1 FROM public.memberships AS m
      WHERE m.tenant_id = membership_roles.tenant_id
        AND m.id = membership_roles.membership_id
        AND m.user_id = (SELECT auth.uid())
        AND m.status = 'active'
    )
  );

DROP POLICY IF EXISTS tenant_scope_assignments_select_self ON public.tenant_scope_assignments;
CREATE POLICY tenant_scope_assignments_select_self ON public.tenant_scope_assignments
  FOR SELECT TO authenticated
  USING (
    private.has_tenant_membership(tenant_id)
    AND EXISTS (
      SELECT 1 FROM public.memberships AS m
      WHERE m.tenant_id = tenant_scope_assignments.tenant_id
        AND m.id = tenant_scope_assignments.membership_id
        AND m.user_id = (SELECT auth.uid())
        AND m.status = 'active'
    )
  );

DROP POLICY IF EXISTS membership_org_assignments_select_self_or_admin
  ON public.membership_org_assignments;
CREATE POLICY membership_org_assignments_select_self_or_admin
  ON public.membership_org_assignments FOR SELECT TO authenticated
  USING (
    (
      private.has_tenant_membership(tenant_id)
      AND EXISTS (
        SELECT 1 FROM public.memberships AS m
        WHERE m.tenant_id = membership_org_assignments.tenant_id
          AND m.id = membership_org_assignments.membership_id
          AND m.user_id = (SELECT auth.uid())
          AND m.status = 'active'
      )
    )
    OR private.has_tenant_permission(tenant_id, 'membership.read')
  );

DROP POLICY IF EXISTS membership_org_unit_scopes_select_self_or_admin
  ON public.membership_org_unit_scopes;
CREATE POLICY membership_org_unit_scopes_select_self_or_admin
  ON public.membership_org_unit_scopes FOR SELECT TO authenticated
  USING (
    (
      private.has_tenant_membership(tenant_id)
      AND EXISTS (
        SELECT 1 FROM public.memberships AS m
        WHERE m.tenant_id = membership_org_unit_scopes.tenant_id
          AND m.id = membership_org_unit_scopes.membership_id
          AND m.user_id = (SELECT auth.uid())
          AND m.status = 'active'
      )
    )
    OR private.has_tenant_permission(tenant_id, 'scope.assign')
  );

DROP POLICY IF EXISTS membership_reporting_select_participant_or_admin
  ON public.membership_reporting_relationships;
CREATE POLICY membership_reporting_select_participant_or_admin
  ON public.membership_reporting_relationships FOR SELECT TO authenticated
  USING (
    (
      private.has_tenant_membership(tenant_id)
      AND EXISTS (
        SELECT 1 FROM public.memberships AS m
        WHERE m.tenant_id = membership_reporting_relationships.tenant_id
          AND m.id IN (
            membership_reporting_relationships.membership_id,
            membership_reporting_relationships.reports_to_membership_id
          )
          AND m.user_id = (SELECT auth.uid())
          AND m.status = 'active'
      )
    )
    OR private.has_tenant_permission(tenant_id, 'membership.read')
  );

COMMIT;
