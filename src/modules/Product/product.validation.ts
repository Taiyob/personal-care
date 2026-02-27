import { z } from "zod";

const slugSchema = z
  .string()
  .min(2)
  .max(150)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Slug must be lowercase with hyphens only",
  )
  .trim();

// ─── Admin: Create / Update ───────────────────────────────────────────────────

export const ProductValidation = {
  /**
   * POST /api/products  (admin)
   */
  create: z
    .object({
      name: z
        .string()
        .min(2, "Name must be at least 2 characters")
        .max(200)
        .trim(),
      slug: slugSchema.optional(),
      description: z
        .string()
        .min(10, "Description must be at least 10 characters")
        .trim(),
      shortDescription: z.string().max(300).trim().optional(),
      price: z.number().positive("Price must be positive"),
      discountPrice: z
        .number()
        .min(0, "Discount price must be at least 0")
        .optional()
        .nullable(),
      stock: z.number().int().min(0, "Stock cannot be negative").default(0),
      sku: z.string().max(100).trim().optional(),
      // Images supplied via MinIO upload (controller injects URL) OR as URL string
      featuredImage: z.string().url("Must be a valid URL").optional(),
      images: z
        .array(z.object({ url: z.string().url(), alt: z.string().optional() }))
        .optional()
        .default([]),
      isFeatured: z.boolean().default(false),
      isNewArrival: z.boolean().default(false),
      status: z.enum(["active", "draft", "inactive"]).default("active"),
      categoryId: z
        .string()
        .uuid("Category ID must be a valid UUID")
        .optional()
        .nullable(),
    })
    .refine((d) => !d.discountPrice || d.discountPrice < d.price, {
      message: "Discount price must be less than original price",
      path: ["discountPrice"],
    }),

  update: z
    .object({
      name: z.string().min(2).max(200).trim().optional(),
      slug: slugSchema.optional(),
      description: z.string().min(10).trim().optional(),
      shortDescription: z.string().max(300).trim().optional(),
      price: z.number().positive().optional(),
      discountPrice: z.number().min(0).optional().nullable(),
      stock: z.number().int().min(0).optional(),
      sku: z.string().max(100).trim().optional(),
      featuredImage: z.string().url().optional(),
      images: z
        .array(z.object({ url: z.string().url(), alt: z.string().optional() }))
        .optional(),
      isFeatured: z.boolean().optional(),
      isNewArrival: z.boolean().optional(),
      status: z.enum(["active", "draft", "inactive"]).optional(),
      categoryId: z.string().uuid().optional().nullable(),
    })
    .strict(),

  // ─── Public: Shop page query params ──────────────────────────────────────
  /**
   * GET /api/products
   * All filters used on the shop page:
   * category, minPrice, maxPrice, minRating, isFeatured, isNewArrival,
   * status, search, sortBy, order, page, limit
   */
  shopQuery: z
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
      // Category filter (by slug or id)
      category: z.string().optional(),
      categoryId: z.string().uuid().optional(),
      // Price range filter
      minPrice: z.string().transform(Number).pipe(z.number().min(0)).optional(),
      maxPrice: z.string().transform(Number).pipe(z.number().min(0)).optional(),
      // Rating filter (minimum avg rating)
      minRating: z
        .string()
        .transform(Number)
        .pipe(z.number().min(1).max(5))
        .optional(),
      // Boolean flags
      isFeatured: z
        .string()
        .transform((v) => v === "true")
        .optional(),
      isNewArrival: z
        .string()
        .transform((v) => v === "true")
        .optional(),
      inStock: z
        .string()
        .transform((v) => v === "true")
        .optional(),
      // Search
      search: z.string().max(200).trim().optional(),
      // Sort
      sortBy: z
        .enum(["price", "name", "createdAt", "rating", "discountPrice"])
        .default("createdAt"),
      order: z.enum(["asc", "desc"]).default("desc"),
      // Admin filter
      status: z.enum(["active", "draft", "inactive"]).optional(),
    })
    .strict(),

  params: {
    id: z.object({ id: z.string().uuid("Product ID must be a valid UUID") }),
    slug: z.object({ slug: z.string().min(1) }),
  },

  // Stock update (admin)
  updateStock: z
    .object({
      stock: z.number().int().min(0, "Stock cannot be negative"),
    })
    .strict(),
};

export type CreateProductInput = z.infer<typeof ProductValidation.create>;
export type UpdateProductInput = z.infer<typeof ProductValidation.update>;
export type ProductShopQuery = z.infer<typeof ProductValidation.shopQuery>;
