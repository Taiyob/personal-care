import { BaseService } from "@/core/BaseService";
import { AppLogger } from "@/core/logging/logger";
import {
  ConflictError,
  NotFoundError,
  AuthorizationError,
  BadRequestError,
} from "@/core/errors/AppError";
import { PrismaClient, Review } from "@/generated/prisma/client";
import {
  CreateReviewInput,
  ReviewListQuery,
  UpdateReviewInput,
} from "./review.validation";

const REVIEW_INCLUDE = {
  user: {
    select: { id: true, firstName: true, lastName: true, avatarUrl: true },
  },
};

export class ReviewService extends BaseService<Review> {
  constructor(prisma: PrismaClient) {
    super(prisma, "Review", { enableAuditFields: true });
  }

  protected getModel() {
    return this.prisma.review;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CREATE REVIEW  (authenticated user)
  // ─────────────────────────────────────────────────────────────────────────
  async createReview(
    productId: string,
    userId: string,
    data: CreateReviewInput,
  ): Promise<Review> {
    // Check product exists
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product || product.status !== "active") {
      throw new NotFoundError("Product not found");
    }

    // One review per user per product
    const existing = await this.prisma.review.findUnique({
      where: { userId_productId: { userId, productId } },
    });
    if (existing) {
      throw new ConflictError("You have already reviewed this product");
    }

    // Check if user has purchased this product (optional but good practice)
    // Uncomment to enforce purchase requirement:
    // const hasPurchased = await this.prisma.orderItem.findFirst({
    //     where: { productId, order: { userId, status: 'delivered' } },
    // });
    // if (!hasPurchased) throw new BadRequestError('You can only review products you have purchased');

    const review = await this.create({
      userId,
      productId,
      rating: data.rating,
      comment: data.comment,
      isApproved: false, // Admin approves
    });

    AppLogger.info("Review created", {
      reviewId: review.id,
      productId,
      userId,
    });
    return review;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // UPDATE REVIEW  (owner only)
  // ─────────────────────────────────────────────────────────────────────────
  async updateReview(
    reviewId: string,
    userId: string,
    data: UpdateReviewInput,
  ): Promise<Review> {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
    });
    if (!review) throw new NotFoundError("Review not found");

    if (review.userId !== userId) {
      throw new AuthorizationError("You can only edit your own reviews");
    }

    // Reset approval after edit
    const updated = await this.updateById(reviewId, {
      ...data,
      isApproved: false,
    });

    AppLogger.info("Review updated", { reviewId, userId });
    return updated;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DELETE REVIEW  (owner or admin)
  // ─────────────────────────────────────────────────────────────────────────
  async deleteReview(
    reviewId: string,
    userId: string,
    userRole: string,
  ): Promise<{ message: string }> {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
    });
    if (!review) throw new NotFoundError("Review not found");

    if (review.userId !== userId && userRole !== "admin") {
      throw new AuthorizationError("You can only delete your own reviews");
    }

    await this.deleteById(reviewId);

    AppLogger.info("Review deleted", { reviewId, deletedBy: userId });
    return { message: "Review deleted successfully" };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GET REVIEWS FOR A PRODUCT  (public)
  // ─────────────────────────────────────────────────────────────────────────
  async getProductReviews(productId: string, query: ReviewListQuery) {
    const {
      page = 1,
      limit = 10,
      minRating,
      sortBy = "createdAt",
      order = "desc",
    } = query;

    // Check product exists
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) throw new NotFoundError("Product not found");

    const where: any = { productId, isApproved: true };

    if (minRating !== undefined) {
      where.rating = { gte: minRating };
    }

    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sortBy]: order },
        include: REVIEW_INCLUDE,
      }),
      this.prisma.review.count({ where }),
    ]);

    // Rating summary  (for the "4.6 out of 5" section in image)
    const allApproved = await this.prisma.review.findMany({
      where: { productId, isApproved: true },
      select: { rating: true },
    });

    const ratingCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    allApproved.forEach((r) => {
      ratingCounts[r.rating as keyof typeof ratingCounts]++;
    });

    const totalReviews = allApproved.length;
    const avgRating =
      totalReviews > 0
        ? parseFloat(
            (
              allApproved.reduce((s, r) => s + r.rating, 0) / totalReviews
            ).toFixed(1),
          )
        : 0;

    const totalPages = Math.ceil(total / limit);

    return {
      summary: {
        avgRating,
        totalReviews,
        ratingBreakdown: ratingCounts,
      },
      data: reviews,
      total,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrevious: page > 1,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // APPROVE / REJECT REVIEW  (admin)
  // ─────────────────────────────────────────────────────────────────────────
  async approveReview(reviewId: string, approve: boolean): Promise<Review> {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
    });
    if (!review) throw new NotFoundError("Review not found");

    const updated = await this.updateById(reviewId, { isApproved: approve });

    AppLogger.info(`Review ${approve ? "approved" : "rejected"}`, { reviewId });
    return updated;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GET ALL REVIEWS  (admin — with pending filter)
  // ─────────────────────────────────────────────────────────────────────────
  async getAllReviews(query: {
    page?: number;
    limit?: number;
    isApproved?: boolean;
  }) {
    const { page = 1, limit = 20, isApproved } = query;

    const where: any = {};
    if (isApproved !== undefined) where.isApproved = isApproved;

    return this.findMany(
      where,
      { page, limit, offset: (page - 1) * limit },
      { createdAt: "desc" },
      {
        ...REVIEW_INCLUDE,
        product: {
          select: { id: true, name: true, slug: true, featuredImage: true },
        },
      },
    );
  }
}
