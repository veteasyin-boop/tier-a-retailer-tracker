import { z } from "zod";

const organizationPaginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).max(10000).default(0),
  includeInactive: z.enum(["true", "false"]).default("false")
}).strict();

/** Query contract shared by unit types and designations. */
export const organizationMetadataListQuerySchema = organizationPaginationQuerySchema;

/** Query contract for organizational units, which additionally support tree filters. */
export const organizationListQuerySchema = organizationPaginationQuerySchema.extend({
  parentId: z.string().uuid().optional(),
  rootsOnly: z.enum(["true", "false"]).default("false")
}).strict().superRefine((value, ctx) => {
  if (value.parentId && value.rootsOnly === "true") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["parentId"],
      message: "parentId and rootsOnly cannot be used together"
    });
  }
});
