import { BaseService } from "@/core/BaseService";
import { AppLogger } from "@/core/logging/logger";
import {
  ConflictError,
  NotFoundError,
  BadRequestError,
} from "@/core/errors/AppError";
import { PrismaClient, Product } from "@/generated/prisma/client";
import {
  CreateProductInput,
  ProductShopQuery,
  UpdateProductInput,
} from "./product.validation";
import { CacheService } from "@/core/CacheService";

// Shared include for product detail (used in single product + list)
const PRODUCT_LIST_INCLUDE = {
  category: { select: { id: true, name: true, slug: true } },
  _count: { select: { reviews: true } },
};

const PRODUCT_DETAIL_INCLUDE = {
  category: { select: { id: true, name: true, slug: true } },
  reviews: {
    where: { isApproved: true },
    orderBy: { createdAt: "desc" as const },
    take: 5,
    select: {
      id: true,
      rating: true,
      comment: true,
      createdAt: true,
      user: { select: { firstName: true, lastName: true, avatarUrl: true } },
    },
  },
  _count: { select: { reviews: true } },
};

export class ProductService extends BaseService<Product> {
  constructor(prisma: PrismaClient, private cache: CacheService) {
    super(prisma, "Product", {
      enableSoftDelete: false,
      enableAuditFields: true,
    });
  }

  protected getModel() {
    return this.prisma.product;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CREATE PRODUCT  (admin)
  // ─────────────────────────────────────────────────────────────────────────
  async createProduct(data: CreateProductInput): Promise<Product> {
    const slug = data.slug ?? (await this.generateUniqueSlug(data.name));

    // SKU uniqueness check
    if (data.sku) {
      const existingSku = await this.prisma.product.findUnique({
        where: { sku: data.sku },
      });
      if (existingSku)
        throw new ConflictError(`SKU "${data.sku}" is already in use`);
    }

    // Category existence check
    if (data.categoryId) {
      const cat = await this.prisma.category.findUnique({
        where: { id: data.categoryId },
      });
      if (!cat) throw new NotFoundError("Category not found");
    }

    const product = await this.create({ ...data, slug });

    // Invalidate product cache
    await this.cache.delByPattern("products:*");

    AppLogger.info("Product created", { id: product.id, name: product.name });
    return product;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // UPDATE PRODUCT  (admin)
  // ─────────────────────────────────────────────────────────────────────────
  async updateProduct(id: string, data: UpdateProductInput): Promise<Product> {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundError("Product not found");

    // Auto-regen slug if name changed
    let slug = data.slug;
    if (data.name && data.name !== product.name && !slug) {
      slug = await this.generateUniqueSlug(data.name, id);
    }

    // SKU uniqueness
    if (data.sku && data.sku !== product.sku) {
      const existing = await this.prisma.product.findUnique({
        where: { sku: data.sku },
      });
      if (existing)
        throw new ConflictError(`SKU "${data.sku}" is already in use`);
    }

    if (data.categoryId) {
      const cat = await this.prisma.category.findUnique({
        where: { id: data.categoryId },
      });
      if (!cat) throw new NotFoundError("Category not found");
    }

    const updated = await this.updateById(id, {
      ...data,
      ...(slug ? { slug } : {}),
    });

    // Invalidate product cache
    await this.cache.delByPattern("products:*");
    // Also invalidate specific slug/id just in case delByPattern is async or delayed
    await this.cache.del(`products:slug:${updated.slug}`);
    await this.cache.del(`products:id:${id}`);

    AppLogger.info("Product updated", { id });
    return updated;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DELETE PRODUCT  (admin)
  // ─────────────────────────────────────────────────────────────────────────
  async deleteProduct(id: string): Promise<{ message: string }> {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { orderItems: { take: 1 } },
    });

    if (!product) throw new NotFoundError("Product not found");

    if (product.orderItems.length > 0) {
      // Soft-delete: just set status inactive, don't physically delete
      await this.updateById(id, { status: "inactive" });
      AppLogger.info("Product deactivated (has orders)", { id });
      return {
        message: "Product deactivated successfully (it has existing orders)",
      };
    }

    await this.deleteById(id);

    // Invalidate product cache
    await this.cache.delByPattern("products:*");
    await this.cache.del(`products:slug:${product.slug}`);
    await this.cache.del(`products:id:${id}`);

    AppLogger.info("Product deleted", { id, name: product.name });
    return { message: "Product deleted successfully" };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GET PRODUCTS  (public — shop page with all filters)
  // ─────────────────────────────────────────────────────────────────────────
  async getProducts(query: ProductShopQuery) {
    const {
      page = 1,
      limit = 12,
      category,
      categoryId,
      minPrice,
      maxPrice,
      minRating,
      isFeatured,
      isNewArrival,
      inStock,
      search,
      sortBy = "createdAt",
      order = "desc",
      status,
    } = query;

    const where: any = {
      status: status ?? "active", // public only sees active products
    };

    // Cache Key Strategy: only cache default public shop views
    const isCacheable = !search && !category && !categoryId && minPrice === undefined && maxPrice === undefined && minRating === undefined && isFeatured === undefined && isNewArrival === undefined && inStock === undefined && status === undefined;
    const cacheKey = `products:all:p${page}:l${limit}:${sortBy}:${order}`;

    if (isCacheable) {
      const cached = await this.cache.get<any>(cacheKey);
      if (cached) return cached;
    }

    // ── Filters ──────────────────────────────────────────────────────
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { shortDescription: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    // Category filter: by slug (public) or id (admin)
    if (category) {
      const cat = await this.prisma.category.findUnique({
        where: { slug: category },
      });
      if (cat) where.categoryId = cat.id;
    } else if (categoryId) {
      where.categoryId = categoryId;
    }

    // Price range
    if (minPrice !== undefined || maxPrice !== undefined) {
      where.price = {};
      if (minPrice !== undefined) where.price.gte = minPrice;
      if (maxPrice !== undefined) where.price.lte = maxPrice;
    }

    // Boolean flags
    if (isFeatured !== undefined) where.isFeatured = isFeatured;
    if (isNewArrival !== undefined) where.isNewArrival = isNewArrival;
    if (inStock) where.stock = { gt: 0 };

    // ── Rating filter: requires subquery via raw or filtered join ────
    // We fetch with avg rating via a post-filter approach for simplicity
    // (for heavy traffic, add a denormalized avgRating column)

    // ── Order By ─────────────────────────────────────────────────────
    const orderByMap: Record<string, any> = {
      price: { price: order },
      discountPrice: { discountPrice: order },
      name: { name: order },
      createdAt: { createdAt: order },
      rating: { reviews: { _count: order } }, // approximate sort
    };

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: orderByMap[sortBy] ?? { createdAt: "desc" },
        include: {
          ...PRODUCT_LIST_INCLUDE,
          // Include avg rating
          reviews: {
            where: { isApproved: true },
            select: { rating: true },
          },
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    // Compute avgRating per product & apply minRating filter
    let enriched = products.map((p) => {
      const ratings = p.reviews.map((r) => r.rating);
      const avgRating =
        ratings.length > 0
          ? parseFloat(
            (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1),
          )
          : 0;

      const { reviews, ...rest } = p;
      return { ...rest, avgRating, reviewCount: ratings.length };
    });

    if (minRating !== undefined) {
      enriched = enriched.filter((p) => p.avgRating >= minRating);
    }

    const totalPages = Math.ceil(total / limit);

    const result = {
      data: enriched,
      total,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrevious: page > 1,
    };

    if (isCacheable) {
      await this.cache.set(cacheKey, result);
    }

    return result;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GET SINGLE PRODUCT BY SLUG  (public — single product page)
  // ─────────────────────────────────────────────────────────────────────────
  async getProductBySlug(slug: string) {
    const cacheKey = `products:slug:${slug}`;
    const cached = await this.cache.get<any>(cacheKey);
    if (cached) return cached;

    const product = await this.prisma.product.findUnique({
      where: { slug },
      include: PRODUCT_DETAIL_INCLUDE,
    });

    if (!product || product.status === "inactive") {
      throw new NotFoundError("Product not found");
    }

    const enriched = await this.enrichWithRatingSummary(product);
    await this.cache.set(cacheKey, enriched);
    return enriched;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GET SINGLE PRODUCT BY ID  (admin)
  // ─────────────────────────────────────────────────────────────────────────
  async getProductById(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: PRODUCT_DETAIL_INCLUDE,
    });

    if (!product) throw new NotFoundError("Product not found");
    return this.enrichWithRatingSummary(product);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GET FEATURED PRODUCTS  (public — home page "Best Selling / Featured")
  // ─────────────────────────────────────────────────────────────────────────
  async getFeaturedProducts(limit = 8) {
    const cacheKey = `products:featured:l${limit}`;
    const cached = await this.cache.get<any>(cacheKey);
    if (cached) return cached;

    const products = await this.prisma.product.findMany({
      where: { isFeatured: true, status: "active", stock: { gt: 0 } },
      take: limit,
      orderBy: { createdAt: "desc" },
      include: PRODUCT_LIST_INCLUDE,
    });

    await this.cache.set(cacheKey, products);
    return products;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GET NEW ARRIVALS  (public — home page)
  // ─────────────────────────────────────────────────────────────────────────
  async getNewArrivals(limit = 8) {
    const cacheKey = `products:new_arrivals:l${limit}`;
    const cached = await this.cache.get<any>(cacheKey);
    if (cached) return cached;

    const products = await this.prisma.product.findMany({
      where: { isNewArrival: true, status: "active", stock: { gt: 0 } },
      take: limit,
      orderBy: { createdAt: "desc" },
      include: PRODUCT_LIST_INCLUDE,
    });

    await this.cache.set(cacheKey, products);
    return products;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GET TOP RATED PRODUCTS  (public — home page "Top Rated Product")
  // ─────────────────────────────────────────────────────────────────────────
  async getTopRatedProducts(limit = 8) {
    // Fetch more, then sort by computed avg rating
    const products = await this.prisma.product.findMany({
      where: { status: "active", stock: { gt: 0 } },
      take: limit * 3, // fetch extra to sort & trim
      include: {
        ...PRODUCT_LIST_INCLUDE,
        reviews: { where: { isApproved: true }, select: { rating: true } },
      },
    });

    return products
      .map((p) => {
        const ratings = p.reviews.map((r) => r.rating);
        const avgRating =
          ratings.length > 0
            ? parseFloat(
              (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(
                1,
              ),
            )
            : 0;
        const { reviews, ...rest } = p;
        return { ...rest, avgRating, reviewCount: ratings.length };
      })
      .filter((p) => p.reviewCount > 0)
      .sort((a, b) => b.avgRating - a.avgRating)
      .slice(0, limit);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GET RELATED PRODUCTS  (public — "Shop Your Perfect Skin Match")
  // Same category, exclude current product
  // ─────────────────────────────────────────────────────────────────────────
  async getRelatedProducts(productId: string, limit = 6) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) throw new NotFoundError("Product not found");

    return this.prisma.product.findMany({
      where: {
        id: { not: productId },
        categoryId: product.categoryId,
        status: "active",
        stock: { gt: 0 },
      },
      take: limit,
      orderBy: { createdAt: "desc" },
      include: PRODUCT_LIST_INCLUDE,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // UPDATE STOCK  (admin)
  // ─────────────────────────────────────────────────────────────────────────
  async updateStock(id: string, stock: number): Promise<Product> {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundError("Product not found");

    const updated = await this.updateById(id, { stock });

    // Invalidate product cache (stock changes affect listing and details)
    await this.cache.delByPattern("products:*");
    await this.cache.del(`products:slug:${product.slug}`);
    await this.cache.del(`products:id:${id}`);

    AppLogger.info("Product stock updated", {
      id,
      oldStock: product.stock,
      newStock: stock,
    });
    return updated;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PRIVATE: Enrich product with rating breakdown (for single product page)
  // ─────────────────────────────────────────────────────────────────────────
  private async enrichWithRatingSummary(product: any) {
    // Full rating stats for the single product page
    const allRatings = await this.prisma.review.findMany({
      where: { productId: product.id, isApproved: true },
      select: { rating: true },
    });

    const ratingCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    allRatings.forEach((r) => {
      ratingCounts[r.rating as keyof typeof ratingCounts]++;
    });

    const totalReviews = allRatings.length;
    const avgRating =
      totalReviews > 0
        ? parseFloat(
          (
            allRatings.reduce((s, r) => s + r.rating, 0) / totalReviews
          ).toFixed(1),
        )
        : 0;

    return {
      ...product,
      avgRating,
      totalReviews,
      ratingBreakdown: ratingCounts,
    };
  }
}
