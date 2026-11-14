import { z } from "zod";

const jsonObjectSchema = z.record(z.unknown());

export const createAuditEventSchema = z.object({
  requestId: z.string().min(1).max(128),
  action: z.string().trim().min(1).max(100),
  entityType: z.string().trim().min(1).max(100),
  entityId: z.string().trim().min(1).max(255),
  beforeData: z.unknown().optional(),
  afterData: z.unknown().optional(),
  metadata: jsonObjectSchema.default({})
}).strict();

export const auditListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().min(1).max(512).optional(),
  entityType: z.string().trim().min(1).max(100).optional()
}).strict();

export type CreateAuditEventInput = z.infer<typeof createAuditEventSchema>;

export const auditCursorSchema = z.object({
  createdAt: z.string().datetime({ offset: true }),
  id: z.string().uuid()
}).strict();
