import { BaseModule } from "@/core/BaseModule";
import { WishlistService } from "./wishlist.service";
import { WishlistController } from "./wishlist.controller";
import { WishlistRoutes } from "./wishlist.routes";

export class WishlistModule extends BaseModule {
    public readonly name = "WishlistModule";
    public readonly version = "1.0.0";
    public readonly dependencies = ["AuthModule", "ProductModule"];

    private wishlistService!: WishlistService;
    private wishlistController!: WishlistController;
    private wishlistRoutes!: WishlistRoutes;

    protected async setupServices(): Promise<void> {
        this.wishlistService = new WishlistService(this.context.prisma);
    }

    protected async setupRoutes(): Promise<void> {
        this.wishlistController = new WishlistController(this.wishlistService);
        this.wishlistRoutes = new WishlistRoutes(this.wishlistController);

        this.router.use("/api/wishlist", this.wishlistRoutes.getRouter());
    }
}
