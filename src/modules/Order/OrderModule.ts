import { BaseModule } from "@/core/BaseModule";
import { OrderService } from "./order.service";
import { OrderController } from "./order.controller";
import { OrderRoutes } from "./order.routes";

export class OrderModule extends BaseModule {
    public readonly name = "OrderModule";
    public readonly version = "1.0.0";
    public readonly dependencies = ["AuthModule", "CartModule", "ProductModule", "AddressModule"];

    private orderService!: OrderService;
    private orderController!: OrderController;
    private orderRoutes!: OrderRoutes;

    protected async setupServices(): Promise<void> {
        this.orderService = new OrderService(this.context.prisma);
    }

    protected async setupRoutes(): Promise<void> {
        this.orderController = new OrderController(this.orderService);
        this.orderRoutes = new OrderRoutes(this.orderController);

        this.router.use("/api/orders", this.orderRoutes.getRouter());
    }
}
