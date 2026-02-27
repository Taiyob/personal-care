import { Router } from "express";
import { PaymentController } from "./payment.controller";
import { authenticate } from "@/middleware/auth";
import { asyncHandler } from "@/middleware/asyncHandler";

export class PaymentRoutes {
    private router: Router;

    constructor(private paymentController: PaymentController) {
        this.router = Router();
        this.initializeRoutes();
    }

    private initializeRoutes() {
        this.router.post(
            "/create-checkout-session",
            authenticate,
            asyncHandler(this.paymentController.createCheckoutSession)
        );

        this.router.get(
            "/my-payments",
            authenticate,
            asyncHandler(this.paymentController.getMyPayments)
        );

        this.router.post(
            "/webhook",
            asyncHandler(this.paymentController.stripeWebhook)
        );
    }

    public getRouter(): Router {
        return this.router;
    }
}
