import { Request, Response } from "express";
import { BaseController } from "@/core/BaseController";
import { ReviewService } from "./review.service";
import { HTTPStatusCode } from "@/types/HTTPStatusCode";
import { RequestWithUser } from "@/middleware/auth";

export class ReviewController extends BaseController {
  constructor(private reviewService: ReviewService) {
    super();
  }

  // POST /api/products/:productId/reviews  (authenticated)
  public createReview = async (req: RequestWithUser, res: Response) => {
    const { productId } = req.validatedParams || req.params;
    const body = req.validatedBody || req.body;
    const userId = this.getUserId(req)!;

    this.logAction("createReview", req, { productId, userId });

    const review = await this.reviewService.createReview(
      productId,
      userId,
      body,
    );

    return this.sendCreatedResponse(
      res,
      review,
      "Review submitted successfully. It will be visible after approval.",
    );
  };

  // PUT /api/products/:productId/reviews/:reviewId  (owner)
  public updateReview = async (req: RequestWithUser, res: Response) => {
    const { reviewId } = req.validatedParams || req.params;
    const body = req.validatedBody || req.body;
    const userId = this.getUserId(req)!;

    this.logAction("updateReview", req, { reviewId, userId });

    const review = await this.reviewService.updateReview(
      reviewId,
      userId,
      body,
    );

    return this.sendResponse(
      res,
      "Review updated successfully",
      HTTPStatusCode.OK,
      review,
    );
  };

  // DELETE /api/products/:productId/reviews/:reviewId  (owner or admin)
  public deleteReview = async (req: RequestWithUser, res: Response) => {
    const { reviewId } = req.validatedParams || req.params;
    const userId = this.getUserId(req)!;
    const userRole = (req as any).userRole || "user";

    this.logAction("deleteReview", req, { reviewId, userId });

    const result = await this.reviewService.deleteReview(
      reviewId,
      userId,
      userRole,
    );

    return this.sendResponse(res, result.message, HTTPStatusCode.OK);
  };

  // GET /api/products/:productId/reviews  (public)
  public getProductReviews = async (req: Request, res: Response) => {
    const { productId } = req.validatedParams || req.params;
    const query = req.validatedQuery || req.query;

    const result = await this.reviewService.getProductReviews(
      productId,
      query as any,
    );

    // Paginated response with summary included in meta
    return res.status(HTTPStatusCode.OK).json({
      success: true,
      message: "Reviews retrieved successfully",
      meta: {
        requestId: (req as any).id,
        timestamp: new Date().toISOString(),
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: result.totalPages,
          hasNext: result.hasNext,
          hasPrevious: result.hasPrevious,
        },
        summary: result.summary,
      },
      data: result.data,
    });
  };

  // PATCH /api/admin/reviews/:reviewId/approve  (admin)
  public approveReview = async (req: Request, res: Response) => {
    const { reviewId } = req.validatedParams || req.params;
    const { approve } = req.body;

    this.logAction("approveReview", req, { reviewId, approve });

    const review = await this.reviewService.approveReview(reviewId, approve);

    return this.sendResponse(
      res,
      `Review ${approve ? "approved" : "rejected"} successfully`,
      HTTPStatusCode.OK,
      review,
    );
  };

  // GET /api/admin/reviews  (admin)
  public getAllReviews = async (req: Request, res: Response) => {
    const pagination = this.extractPaginationParams(req);
    const isApprovedParam = req.query.isApproved;
    const isApproved =
      isApprovedParam !== undefined ? isApprovedParam === "true" : undefined;

    const result = await this.reviewService.getAllReviews({
      page: pagination.page,
      limit: pagination.limit,
      isApproved,
    });

    return this.sendPaginatedResponse(
      res,
      this.calculatePagination(result.page, result.limit, result.total),
      "Reviews retrieved successfully",
      result.data,
    );
  };
}
