import test from "node:test";
import assert from "node:assert/strict";
import { auditListQuerySchema, createAuditEventSchema } from "../src/modules/audit/audit.schemas.js";

test("audit event schema requires bounded event identity", () => {
  const parsed = createAuditEventSchema.safeParse({
    requestId: "req-1",
    action: "membership.role.assigned",
    entityType: "membership",
    entityId: "membership-1"
  });
  assert.equal(parsed.success, true);
});

test("audit event schema rejects oversized fields and unexpected properties", () => {
  const oversized = createAuditEventSchema.safeParse({
    requestId: "r".repeat(129),
    action: "x",
    entityType: "membership",
    entityId: "1"
  });
  assert.equal(oversized.success, false);

  const extra = createAuditEventSchema.safeParse({
    requestId: "req-1",
    action: "x",
    entityType: "membership",
    entityId: "1",
    token: "must-not-be-accepted"
  });
  assert.equal(extra.success, false);
});

test("audit list query bounds page size and validates cursor timestamps", () => {
  assert.equal(auditListQuerySchema.safeParse({ limit: "50" }).success, true);
  assert.equal(auditListQuerySchema.safeParse({ limit: "1000" }).success, false);
  assert.equal(auditListQuerySchema.safeParse({ before: "not-a-date" }).success, false);
});
