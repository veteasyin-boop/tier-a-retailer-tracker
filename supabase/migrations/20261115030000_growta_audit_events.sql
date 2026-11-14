-- Growta immutable audit event store for Auth-backed memberships.
-- Legacy audit_logs remains untouched because it references legacy public.users.
BEGIN;

CREATE TABLE IF NOT EXISTS public.growta_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  actor_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  request_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (length(action) BETWEEN 1 AND 100),
  entity_type TEXT NOT NULL CHECK (length(entity_type) BETWEEN 1 AND 100),
  entity_id TEXT NOT NULL CHECK (length(entity_id) BETWEEN 1 AND 255),
  before_data JSONB,
  after_data JSONB,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_growta_audit_metadata_object CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX IF NOT EXISTS idx_growta_audit_tenant_created
  ON public.growta_audit_events (tenant_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_growta_audit_tenant_entity
  ON public.growta_audit_events (tenant_id, entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_growta_audit_tenant_actor
  ON public.growta_audit_events (tenant_id, actor_user_id, created_at DESC);

ALTER TABLE public.growta_audit_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.growta_audit_events FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.growta_audit_events TO service_role;

-- Audit events are append-only. API service_role is the only writer.
-- Read access is mediated by the Fastify API after checking audit.read.
COMMIT;
