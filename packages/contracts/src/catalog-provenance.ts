import { z } from "zod";
/** Read-only provenance retained in already installed library manifests. */
export const MarketplaceSourceSchema = z
  .object({
    contentType: z.enum(["group", "library", "skill"]),
    contentId: z.string().trim().min(1).max(512),
    version: z.number().int().positive(),
    installedAt: z.string().datetime(),
    bucketKind: z.enum(["general", "plot", "style", "other"]).optional()
  })
  .strict();
export type MarketplaceSource = z.infer<typeof MarketplaceSourceSchema>;
