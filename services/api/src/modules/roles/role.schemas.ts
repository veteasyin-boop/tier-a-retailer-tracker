import { z } from "zod";

export const roleListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).max(10000).default(0),
  includeInactive: z.enum(["true", "false"]).default("false").transform((value) => value === "true")
}).strict();
