import { Router, Request, Response } from "express";
import { ReviewController } from "./review.controller";
import { validateRequest } from "@/middleware/validation";
import { asyncHandler } from "@/middleware/asyncHandler";
import { authenticate, authorize } from "@/middleware/auth";
import { ReviewValidation } from "./review.validation";

export class ReviewRoutes {
  private productRouter: Router; // mounted at /api/products/:productId/reviews
  private adminRouter: Router; // mounted at /api/admin/reviews

  constructor(private reviewController: ReviewController) {
    this.productRouter = Router({ mergeParams: true }); // mergeParams → gets :productId
    this.adminRouter = Router();
    this.initializeProductRoutes();
    this.initializeAdminRoutes();
  }

  private initializeProductRoutes(): void {
    /**
     * GET /api/products/:productId/reviews
     * Public — review list with rating summary (4.6 out of 5 section in image)
     * Query: ?page&limit&minRating&sortBy&order
     */
    this.productRouter.get(
      "/",
      validateRequest({
        params: ReviewValidation.params.productId,
        query: ReviewValidation.listQuery,
      }),
      asyncHandler((req: Request, res: Response) =>
        this.reviewController.getProductReviews(req, res),
      ),
    );

    /**
     * POST /api/products/:productId/reviews
     * Authenticated user submits a review
     * Body: { rating, comment? }
     */
    this.productRouter.post(
      "/",
      authenticate,
      validateRequest({
        params: ReviewValidation.params.productId,
        body: ReviewValidation.create,
      }),
      asyncHandler((req: Request, res: Response) =>
        this.reviewController.createReview(req, res),
      ),
    );

    /**
     * PUT /api/products/:productId/reviews/:reviewId
     * Owner updates their own review
     * Body: { rating?, comment? }
     */
    this.productRouter.put(
      "/:reviewId",
      authenticate,
      validateRequest({
        params: ReviewValidation.params.combined,
        body: ReviewValidation.update,
      }),
      asyncHandler((req: Request, res: Response) =>
        this.reviewController.updateReview(req, res),
      ),
    );

    /**
     * DELETE /api/products/:productId/reviews/:reviewId
     * Owner or admin deletes a review
     */
    this.productRouter.delete(
      "/:reviewId",
      authenticate,
      validateRequest({ params: ReviewValidation.params.combined }),
      asyncHandler((req: Request, res: Response) =>
        this.reviewController.deleteReview(req, res),
      ),
    );
  }

  private initializeAdminRoutes(): void {
    /**
     * GET /api/admin/reviews
     * All reviews with approval filter
     * Query: ?page&limit&isApproved=true|false
     */
    this.adminRouter.get(
      "/",
      authenticate,
      authorize("admin"),
      asyncHandler((req: Request, res: Response) =>
        this.reviewController.getAllReviews(req, res),
      ),
    );

    /**
     * PATCH /api/admin/reviews/:reviewId/approve
     * Admin approves or rejects a review
     * Body: { approve: boolean }
     */
    this.adminRouter.patch(
      "/:reviewId/approve",
      authenticate,
      authorize("admin"),
      validateRequest({ params: ReviewValidation.params.reviewId }),
      asyncHandler((req: Request, res: Response) =>
        this.reviewController.approveReview(req, res),
      ),
    );
  }

  public getProductRouter(): Router {
    return this.productRouter;
  }

  public getAdminRouter(): Router {
    return this.adminRouter;
  }
}
