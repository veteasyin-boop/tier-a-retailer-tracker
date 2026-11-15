-- Cover new Growta assignment and audit foreign keys with indexes.
BEGIN;
CREATE INDEX IF NOT EXISTS idx_moa_designation
  ON public.membership_org_assignments (tenant_id, designation_id)
  WHERE designation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_moa_assigned_by
  ON public.membership_org_assignments (assigned_by)
  WHERE assigned_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mrr_created_by
  ON public.membership_reporting_relationships (created_by)
  WHERE created_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_growta_audit_actor_user
  ON public.growta_audit_events (actor_user_id);
COMMIT;
