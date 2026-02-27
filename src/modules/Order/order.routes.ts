import { Router, Response } from "express";
import { OrderController } from "./order.controller";
import { validateRequest } from "@/middleware/validation";
import { asyncHandler } from "@/middleware/asyncHandler";
import { authenticate, authorize, RequestWithUser } from "@/middleware/auth";
import { OrderValidation } from "./order.validation";

export class OrderRoutes {
    private router: Router;

    constructor(private orderController: OrderController) {
        this.router = Router();
        this.initializeRoutes();
    }

    private initializeRoutes(): void {
        // History
        this.router.get(
            "/",
            authenticate,
            asyncHandler((req: RequestWithUser, res: Response) =>
                this.orderController.getMyOrders(req, res),
            ),
        );

        // Counts for dashboard
        this.router.get(
            "/counts",
            authenticate,
            asyncHandler((req: RequestWithUser, res: Response) =>
                this.orderController.getOrderCounts(req, res),
            ),
        );

        // Filter by status
        this.router.get(
            "/status",
            authenticate,
            asyncHandler((req: RequestWithUser, res: Response) =>
                this.orderController.getMyOrdersByStatus(req, res),
            ),
        );

        // Checkout
        this.router.post(
            "/",
            authenticate,
            validateRequest({ body: OrderValidation.create }),
            asyncHandler((req: RequestWithUser, res: Response) =>
                this.orderController.placeOrder(req, res),
            ),
        );

        // Tracking (Public or Auth - currently making it public for simplicity if they have number)
        this.router.get(
            "/track/:orderNumber",
            asyncHandler((req: RequestWithUser, res: Response) =>
                this.orderController.trackOrder(req, res),
            ),
        );

        // Cancellation
        this.router.patch(
            "/:id/cancel",
            authenticate,
            validateRequest({ params: OrderValidation.params.id }),
            asyncHandler((req: RequestWithUser, res: Response) =>
                this.orderController.cancelOrder(req, res),
            ),
        );

        // Detail
        this.router.get(
            "/:id",
            authenticate,
            validateRequest({ params: OrderValidation.params.id }),
            asyncHandler((req: RequestWithUser, res: Response) =>
                this.orderController.getOrderDetails(req, res),
            ),
        );

        // --- Admin Routes ---
        this.router.get(
            "/admin/all",
            authenticate,
            authorize('admin'),
            asyncHandler((req: RequestWithUser, res: Response) =>
                this.orderController.getAllOrders(req, res),
            ),
        );

        this.router.patch(
            "/:id/status",
            authenticate,
            authorize('admin'),
            validateRequest({ params: OrderValidation.params.id }),
            asyncHandler((req: RequestWithUser, res: Response) =>
                this.orderController.updateOrderStatus(req, res),
            ),
        );
    }

    public getRouter(): Router {
        return this.router;
    }
}
