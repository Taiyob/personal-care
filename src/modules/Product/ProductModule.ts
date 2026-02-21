import { BaseModule } from "@/core/BaseModule";
import { ProductService } from "./product.service";
import { ProductController } from "./product.controller";
import { ProductRoutes } from "./product.routes";

export class ProductModule extends BaseModule {
  public readonly name = "ProductModule";
  public readonly version = "1.0.0";
  public readonly dependencies = ["CategoryModule"];

  private productService!: ProductService;
  private productController!: ProductController;
  private productRoutes!: ProductRoutes;

  protected async setupServices(): Promise<void> {
    this.productService = new ProductService(this.context.prisma);
  }

  protected async setupRoutes(): Promise<void> {
    this.productController = new ProductController(this.productService);
    this.productRoutes = new ProductRoutes(this.productController);

    this.router.use("/api/products", this.productRoutes.getRouter());
  }

  public getProductService(): ProductService {
    return this.productService;
  }
}
