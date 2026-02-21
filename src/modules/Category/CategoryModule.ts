import { BaseModule } from "@/core/BaseModule";
import { CategoryService } from "./category.service";
import { CategoryController } from "./category.controller";
import { CategoryRoutes } from "./category.routes";

export class CategoryModule extends BaseModule {
  public readonly name = "CategoryModule";
  public readonly version = "1.0.0";
  public readonly dependencies = [];

  private categoryService!: CategoryService;
  private categoryController!: CategoryController;
  private categoryRoutes!: CategoryRoutes;

  protected async setupServices(): Promise<void> {
    this.categoryService = new CategoryService(this.context.prisma);
  }

  protected async setupRoutes(): Promise<void> {
    this.categoryController = new CategoryController(this.categoryService);
    this.categoryRoutes = new CategoryRoutes(this.categoryController);

    this.router.use("/api/categories", this.categoryRoutes.getRouter());
  }

  public getCategoryService(): CategoryService {
    return this.categoryService;
  }
}
