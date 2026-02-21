import { z } from "zod";

export const ReviewValidation = {
  /**
   * POST /api/products/:productId/reviews  (authenticated user)
   */
  create: z
    .object({
      rating: z
        .number()
        .int()
        .min(1, "Rating must be at least 1")
        .max(5, "Rating must be at most 5"),
      comment: z
        .string()
        .min(5, "Comment must be at least 5 characters")
        .max(1000)
        .trim()
        .optional(),
    })
    .strict(),

  update: z
    .object({
      rating: z.number().int().min(1).max(5).optional(),
      comment: z.string().min(5).max(1000).trim().optional(),
    })
    .strict(),

  // GET /api/products/:productId/reviews
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
        .pipe(z.number().int().min(1).max(50))
        .optional(),
      minRating: z
        .string()
        .transform(Number)
        .pipe(z.number().int().min(1).max(5))
        .optional(),
      sortBy: z.enum(["createdAt", "rating"]).default("createdAt"),
      order: z.enum(["asc", "desc"]).default("desc"),
    })
    .strict(),

  params: {
    productId: z.object({
      productId: z.string().uuid("Product ID must be a valid UUID"),
    }),
    reviewId: z.object({
      reviewId: z.string().uuid("Review ID must be a valid UUID"),
    }),
    combined: z.object({
      productId: z.string().uuid(),
      reviewId: z.string().uuid(),
    }),
  },
};

export type CreateReviewInput = z.infer<typeof ReviewValidation.create>;
export type UpdateReviewInput = z.infer<typeof ReviewValidation.update>;
export type ReviewListQuery = z.infer<typeof ReviewValidation.listQuery>;
