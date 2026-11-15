-- Cover foreign keys introduced by the tenant identity and membership model.
BEGIN;
CREATE INDEX IF NOT EXISTS idx_memberships_invited_by
  ON public.memberships (invited_by)
  WHERE invited_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_membership_roles_assigned_by
  ON public.membership_roles (assigned_by)
  WHERE assigned_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_platform_admins_created_by
  ON public.platform_admins (created_by)
  WHERE created_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_membership_org_unit_scopes_assigned_by
  ON public.membership_org_unit_scopes (assigned_by)
  WHERE assigned_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tenant_scope_assignments_organization_fk
  ON public.tenant_scope_assignments (tenant_id, organization_id)
  WHERE organization_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tenant_scope_assignments_territory_fk
  ON public.tenant_scope_assignments (tenant_id, territory_id)
  WHERE territory_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tenant_scope_assignments_assigned_by
  ON public.tenant_scope_assignments (assigned_by)
  WHERE assigned_by IS NOT NULL;
COMMIT;
