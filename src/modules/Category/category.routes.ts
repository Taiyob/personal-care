import { Router, Request, Response } from "express";
import { CategoryController } from "./category.controller";
import { validateRequest } from "@/middleware/validation";
import { asyncHandler } from "@/middleware/asyncHandler";
import { authenticate, authorize } from "@/middleware/auth";
import { CategoryValidation } from "./category.validation";

export class CategoryRoutes {
  private router: Router;

  constructor(private categoryController: CategoryController) {
    this.router = Router();
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    // ── Public routes ──────────────────────────────────────────────────

    /**
     * GET /api/categories
     * Query: ?page&limit&parentId&isActive&search
     * Returns paginated category list
     */
    this.router.get(
      "/",
      validateRequest({ query: CategoryValidation.listQuery }),
      asyncHandler((req: Request, res: Response) =>
        this.categoryController.getCategories(req, res),
      ),
    );

    /**
     * GET /api/categories/tree
     * Returns nested category tree (for home page nav / sidebar)
     */
    this.router.get(
      "/tree",
      asyncHandler((req: Request, res: Response) =>
        this.categoryController.getCategoryTree(req, res),
      ),
    );

    /**
     * GET /api/categories/slug/:slug
     * Single category by slug (for SEO-friendly URLs)
     */
    this.router.get(
      "/slug/:slug",
      validateRequest({ params: CategoryValidation.params.slug }),
      asyncHandler((req: Request, res: Response) =>
        this.categoryController.getCategoryBySlug(req, res),
      ),
    );

    /**
     * GET /api/categories/:id
     * Single category by UUID
     */
    this.router.get(
      "/:id",
      validateRequest({ params: CategoryValidation.params.id }),
      asyncHandler((req: Request, res: Response) =>
        this.categoryController.getCategoryById(req, res),
      ),
    );

    // ── Admin routes ───────────────────────────────────────────────────

    /**
     * POST /api/categories
     * Body: { name, slug?, description?, imageUrl?, parentId?, isActive? }
     */
    this.router.post(
      "/",
      authenticate,
      authorize("admin"),
      validateRequest({ body: CategoryValidation.create }),
      asyncHandler((req: Request, res: Response) =>
        this.categoryController.createCategory(req, res),
      ),
    );

    /**
     * PUT /api/categories/:id
     * Body: partial category fields
     */
    this.router.put(
      "/:id",
      authenticate,
      authorize("admin"),
      validateRequest({
        params: CategoryValidation.params.id,
        body: CategoryValidation.update,
      }),
      asyncHandler((req: Request, res: Response) =>
        this.categoryController.updateCategory(req, res),
      ),
    );

    /**
     * DELETE /api/categories/:id
     */
    this.router.delete(
      "/:id",
      authenticate,
      authorize("admin"),
      validateRequest({ params: CategoryValidation.params.id }),
      asyncHandler((req: Request, res: Response) =>
        this.categoryController.deleteCategory(req, res),
      ),
    );

    /**
     * PATCH /api/categories/:id/toggle-active
     * Toggle isActive status
     */
    this.router.patch(
      "/:id/toggle-active",
      authenticate,
      authorize("admin"),
      validateRequest({ params: CategoryValidation.params.id }),
      asyncHandler((req: Request, res: Response) =>
        this.categoryController.toggleActive(req, res),
      ),
    );
  }

  public getRouter(): Router {
    return this.router;
  }
}
