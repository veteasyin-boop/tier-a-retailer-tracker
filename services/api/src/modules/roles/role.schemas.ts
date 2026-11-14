import { z } from "zod";

export const createRoleSchema = z.object({
  code: z.string().regex(/^[A-Z][A-Z0-9_]{1,49}$/),
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(500).nullable().optional(),
  permissions: z.array(z.string().min(1).max(128)).max(200).default([])
}).strict();
