import { Response } from "express";
import { WishlistService } from "./wishlist.service";
import { RequestWithUser } from "@/middleware/auth";
import { HTTPStatusCode } from "@/types/HTTPStatusCode";
import { AppError } from "@/core/errors/AppError";

export class WishlistController {
    constructor(private wishlistService: WishlistService) { }

    async getWishlist(req: RequestWithUser, res: Response) {
        const userId = req.user!.id;
        const wishlist = await this.wishlistService.getWishlist(userId);
        res.status(HTTPStatusCode.OK).json({ success: true, data: wishlist });
    }

    async addToWishlist(req: RequestWithUser, res: Response) {
        const userId = req.user!.id;
        const { productId } = req.params;
        const item = await this.wishlistService.addToWishlist(userId, productId);
        res.status(HTTPStatusCode.CREATED).json({
            success: true,
            message: "Added to wishlist",
            data: item
        });
    }

    async removeFromWishlist(req: RequestWithUser, res: Response) {
        const userId = req.user!.id;
        const { productId } = req.params;
        await this.wishlistService.removeFromWishlist(userId, productId);
        res.status(HTTPStatusCode.OK).json({
            success: true,
            message: "Removed from wishlist"
        });
    }
}
