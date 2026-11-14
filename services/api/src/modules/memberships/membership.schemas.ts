import { z } from "zod";

export const membershipListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).max(10000).default(0),
  status: z.enum(["invited", "active", "suspended"]).optional()
}).strict();
