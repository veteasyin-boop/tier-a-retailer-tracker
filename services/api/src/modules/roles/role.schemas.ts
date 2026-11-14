import { z } from "zod";

export const roleListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).max(10000).default(0),
  includeInactive: z.enum(["true", "false"]).default("false").transform((value) => value === "true")
}).strict();

export const createRoleSchema = z.object({
  code: z.string().regex(/^[A-Z][A-Z0-9_]{1,49}$/),
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(500).nullable().optional(),
  permissions: z.array(z.string().min(1).max(128)).max(200).default([])
}).strict();

export const updateRoleSchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(500).nullable(),
  isActive: z.boolean(),
  permissions: z.array(z.string().min(1).max(128)).max(200)
}).strict();