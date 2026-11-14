import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditEventSchema, type CreateAuditEventInput } from "./audit.schemas.js";

export type AuditActor = { tenantId: string; userId: string };

export class AuditWriteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuditWriteError";
  }
}

/**
 * Append-only event writer. Call this from the same database transaction/RPC
 * as the business mutation when atomic mutation+audit semantics are required.
 * A standalone PostgREST insert cannot make a preceding independent mutation atomic.
 */
export async function writeAuditEvent(
  admin: SupabaseClient,
  actor: AuditActor,
  input: CreateAuditEventInput
): Promise<string> {
  const parsed = createAuditEventSchema.safeParse(input);
  if (!parsed.success) {
    throw new AuditWriteError("Audit event payload is invalid");
  }

  let payloadBytes: number;
  try {
    payloadBytes = Buffer.byteLength(JSON.stringify({
      beforeData: parsed.data.beforeData ?? null,
      afterData: parsed.data.afterData ?? null,
      metadata: parsed.data.metadata
    }) ?? "{}");
  } catch {
    throw new AuditWriteError("Audit event payload must be JSON serializable");
  }
  if (payloadBytes > 32 * 1024) {
    throw new AuditWriteError("Audit event payload exceeds the 32 KB limit");
  }

  const { data, error } = await admin
    .from("growta_audit_events")
    .insert({
      tenant_id: actor.tenantId,
      actor_user_id: actor.userId,
      request_id: parsed.data.requestId,
      action: parsed.data.action,
      entity_type: parsed.data.entityType,
      entity_id: parsed.data.entityId,
      before_data: parsed.data.beforeData ?? null,
      after_data: parsed.data.afterData ?? null,
      metadata: parsed.data.metadata
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new AuditWriteError("Unable to persist audit event");
  }
  return data.id as string;
}
