import { BaseModule } from "@/core/BaseModule";
import { ReviewService } from "./review.service";
import { ReviewController } from "./review.controller";
import { ReviewRoutes } from "./review.routes";

export class ReviewModule extends BaseModule {
  public readonly name = "ReviewModule";
  public readonly version = "1.0.0";
  public readonly dependencies = ["ProductModule"]; // Products must exist first

  private reviewService!: ReviewService;
  private reviewController!: ReviewController;
  private reviewRoutes!: ReviewRoutes;

  protected async setupServices(): Promise<void> {
    this.reviewService = new ReviewService(this.context.prisma);
  }

  protected async setupRoutes(): Promise<void> {
    this.reviewController = new ReviewController(this.reviewService);
    this.reviewRoutes = new ReviewRoutes(this.reviewController);

    // Nested under products: /api/products/:productId/reviews
    this.router.use(
      "/api/products/:productId/reviews",
      this.reviewRoutes.getProductRouter(),
    );

    // For /api/reviews/my
    this.router.use(
      "/api/reviews/my",
      this.reviewRoutes.getMyReviewsRouter(),
    );

    // Admin routes: /api/admin/reviews
    this.router.use("/api/admin/reviews", this.reviewRoutes.getAdminRouter());
  }
}
