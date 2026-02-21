import { BaseModule } from "@/core/BaseModule";
import { ReturnService } from "./return.service";
import { ReturnController } from "./return.controller";
import { ReturnRoutes } from "./return.routes";

export class ReturnModule extends BaseModule {
    public readonly name = "ReturnModule";
    public readonly version = "1.0.0";
    public readonly dependencies = ["AuthModule", "OrderModule"];

    private returnService!: ReturnService;
    private returnController!: ReturnController;
    private returnRoutes!: ReturnRoutes;

    protected async setupServices(): Promise<void> {
        this.returnService = new ReturnService(this.context.prisma);
    }

    protected async setupRoutes(): Promise<void> {
        this.returnController = new ReturnController(this.returnService);
        this.returnRoutes = new ReturnRoutes(this.returnController);

        this.router.use("/api/returns", this.returnRoutes.getRouter());
    }
}
