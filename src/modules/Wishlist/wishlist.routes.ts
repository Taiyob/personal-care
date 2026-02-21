import { Router, Response } from "express";
import { WishlistController } from "./wishlist.controller";
import { validateRequest } from "@/middleware/validation";
import { asyncHandler } from "@/middleware/asyncHandler";
import { authenticate, RequestWithUser } from "@/middleware/auth";
import { WishlistValidation } from "./wishlist.validation";

export class WishlistRoutes {
    private router: Router;

    constructor(private wishlistController: WishlistController) {
        this.router = Router();
        this.initializeRoutes();
    }

    private initializeRoutes(): void {
        this.router.use(authenticate);

        this.router.get(
            "/",
            asyncHandler((req: RequestWithUser, res: Response) =>
                this.wishlistController.getWishlist(req, res),
            ),
        );

        this.router.post(
            "/:productId",
            validateRequest({ params: WishlistValidation.params.productId }),
            asyncHandler((req: RequestWithUser, res: Response) =>
                this.wishlistController.addToWishlist(req, res),
            ),
        );

        this.router.delete(
            "/:productId",
            validateRequest({ params: WishlistValidation.params.productId }),
            asyncHandler((req: RequestWithUser, res: Response) =>
                this.wishlistController.removeFromWishlist(req, res),
            ),
        );
    }

    public getRouter(): Router {
        return this.router;
    }
}
