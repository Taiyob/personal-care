import { Router, Request, Response } from "express";
import { ProductController } from "./product.controller";
import { validateRequest } from "@/middleware/validation";
import { asyncHandler } from "@/middleware/asyncHandler";
import { authenticate, authorize } from "@/middleware/auth";
import { ProductValidation } from "./product.validation";
import { uploadFields } from "@/middleware/upload";

// Multer fields: featuredImage (single) + images (up to 10)
const productUpload = uploadFields([
  { name: "featuredImage", maxCount: 1 },
  { name: "images", maxCount: 10 },
]);

export class ProductRoutes {
  private router: Router;

  constructor(private productController: ProductController) {
    this.router = Router();
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    // ── Public routes ──────────────────────────────────────────────────

    /**
     * GET /api/products
     * Shop page — all filters:
     * ?page&limit&category&categoryId&minPrice&maxPrice
     * &minRating&isFeatured&isNewArrival&inStock&search&sortBy&order
     */
    this.router.get(
      "/",
      validateRequest({ query: ProductValidation.shopQuery }),
      asyncHandler((req: Request, res: Response) =>
        this.productController.getProducts(req, res),
      ),
    );

    /**
     * GET /api/products/featured
     * Home page "Best Selling Products" section
     * Query: ?limit=8
     */
    this.router.get(
      "/featured",
      asyncHandler((req: Request, res: Response) =>
        this.productController.getFeaturedProducts(req, res),
      ),
    );

    /**
     * GET /api/products/new-arrivals
     * Home page new arrivals section
     * Query: ?limit=8
     */
    this.router.get(
      "/new-arrivals",
      asyncHandler((req: Request, res: Response) =>
        this.productController.getNewArrivals(req, res),
      ),
    );

    /**
     * GET /api/products/top-rated
     * Home page "Top Rated Product" section
     * Query: ?limit=8
     */
    this.router.get(
      "/top-rated",
      asyncHandler((req: Request, res: Response) =>
        this.productController.getTopRatedProducts(req, res),
      ),
    );

    /**
     * GET /api/products/slug/:slug
     * Single product page (public, SEO-friendly)
     */
    this.router.get(
      "/slug/:slug",
      validateRequest({ params: ProductValidation.params.slug }),
      asyncHandler((req: Request, res: Response) =>
        this.productController.getProductBySlug(req, res),
      ),
    );

    /**
     * GET /api/products/:id/related
     * "Shop Your Perfect Skin Match" — related products in same category
     * Query: ?limit=6
     */
    this.router.get(
      "/:id/related",
      validateRequest({ params: ProductValidation.params.id }),
      asyncHandler((req: Request, res: Response) =>
        this.productController.getRelatedProducts(req, res),
      ),
    );

    /**
     * GET /api/products/:id
     * Single product by UUID (also used by admin)
     */
    this.router.get(
      "/:id",
      validateRequest({ params: ProductValidation.params.id }),
      asyncHandler((req: Request, res: Response) =>
        this.productController.getProductById(req, res),
      ),
    );

    // ── Admin routes ───────────────────────────────────────────────────

    /**
     * POST /api/products
     * multipart/form-data: { name, description, price, stock, categoryId, ... }
     * Files: featuredImage (single), images (up to 10)
     */
    this.router.post(
      "/",
      authenticate,
      authorize("admin"),
      productUpload,
      asyncHandler((req: Request, res: Response) =>
        this.productController.createProduct(req, res),
      ),
    );

    /**
     * PUT /api/products/:id
     * multipart/form-data: partial product fields
     * Files: featuredImage (single), images (up to 10)
     */
    this.router.put(
      "/:id",
      authenticate,
      authorize("admin"),
      productUpload,
      asyncHandler((req: Request, res: Response) =>
        this.productController.updateProduct(req, res),
      ),
    );

    /**
     * DELETE /api/products/:id
     * Soft-deletes if product has orders; hard-deletes + removes MinIO images otherwise
     */
    this.router.delete(
      "/:id",
      authenticate,
      authorize("admin"),
      validateRequest({ params: ProductValidation.params.id }),
      asyncHandler((req: Request, res: Response) =>
        this.productController.deleteProduct(req, res),
      ),
    );

    /**
     * PATCH /api/products/:id/stock
     * Body: { stock: number }
     */
    this.router.patch(
      "/:id/stock",
      authenticate,
      authorize("admin"),
      validateRequest({
        params: ProductValidation.params.id,
        body: ProductValidation.updateStock,
      }),
      asyncHandler((req: Request, res: Response) =>
        this.productController.updateStock(req, res),
      ),
    );
  }

  public getRouter(): Router {
    return this.router;
  }
}
