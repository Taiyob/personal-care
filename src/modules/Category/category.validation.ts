import { z } from "zod";

const slugSchema = z
  .string()
  .min(2, "Slug must be at least 2 characters")
  .max(100)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Slug must be lowercase with hyphens only",
  )
  .trim();

export const CategoryValidation = {
  /**
   * POST /api/categories  (admin)
   * PUT  /api/categories/:id  (admin)
   */
  create: z
    .object({
      name: z
        .string()
        .min(2, "Name must be at least 2 characters")
        .max(100, "Name must not exceed 100 characters")
        .trim(),
      slug: slugSchema.optional(), // auto-generated if omitted
      description: z.string().max(500).trim().optional(),
      imageUrl: z.string().url("Must be a valid URL").optional(),
      parentId: z.string().uuid("Parent ID must be a valid UUID").optional(),
      isActive: z.boolean().default(true),
    })
    .strict(),

  update: z
    .object({
      name: z.string().min(2).max(100).trim().optional(),
      slug: slugSchema.optional(),
      description: z.string().max(500).trim().optional(),
      imageUrl: z.string().url().optional(),
      parentId: z.string().uuid().optional().nullable(),
      isActive: z.boolean().optional(),
    })
    .strict(),

  // Query params for GET /api/categories
  listQuery: z
    .object({
      page: z
        .string()
        .transform(Number)
        .pipe(z.number().int().min(1))
        .optional(),
      limit: z
        .string()
        .transform(Number)
        .pipe(z.number().int().min(1).max(100))
        .optional(),
      parentId: z.string().uuid().optional(),
      isActive: z
        .string()
        .transform((v) => v === "true")
        .optional(),
      search: z.string().max(100).trim().optional(),
    })
    .strict(),

  params: {
    id: z.object({ id: z.string().uuid("Category ID must be a valid UUID") }),
    slug: z.object({ slug: z.string().min(1) }),
  },
};

export type CreateCategoryInput = z.infer<typeof CategoryValidation.create>;
export type UpdateCategoryInput = z.infer<typeof CategoryValidation.update>;
export type CategoryListQuery = z.infer<typeof CategoryValidation.listQuery>;
