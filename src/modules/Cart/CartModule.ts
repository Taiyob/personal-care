import { BaseModule } from "@/core/BaseModule";
import { CartService } from "./cart.service";
import { CartController } from "./cart.controller";
import { CartRoutes } from "./cart.routes";

export class CartModule extends BaseModule {
  public readonly name = "CartModule";
  public readonly version = "1.0.0";
  public readonly dependencies = ["ProductModule"];

  private cartService!: CartService;
  private cartController!: CartController;
  private cartRoutes!: CartRoutes;

  protected async setupServices(): Promise<void> {
    this.cartService = new CartService(this.context.prisma);
  }

  protected async setupRoutes(): Promise<void> {
    this.cartController = new CartController(this.cartService);
    this.cartRoutes = new CartRoutes(this.cartController);
    this.router.use("/api/cart", this.cartRoutes.getRouter());
  }

  public getCartService(): CartService {
    return this.cartService;
  }
}
