import { BaseModule } from "@/core/BaseModule";
import { PaymentService } from "./payment.service";
import { PaymentController } from "./payment.controller";
import { PaymentRoutes } from "./payment.routes";

export class PaymentModule extends BaseModule {
    public readonly name = "PaymentModule";
    public readonly version = "1.0.0";
    public readonly dependencies = ["AuthModule", "OrderModule"];

    private paymentService!: PaymentService;
    private paymentController!: PaymentController;
    private paymentRoutes!: PaymentRoutes;

    protected async setupServices(): Promise<void> {
        this.paymentService = new PaymentService(this.context.prisma);
    }

    protected async setupRoutes(): Promise<void> {
        this.paymentController = new PaymentController(this.paymentService);
        this.paymentRoutes = new PaymentRoutes(this.paymentController);

        this.router.use("/api/payments", this.paymentRoutes.getRouter());
    }
}
