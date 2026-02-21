import { Response } from "express";
import { OrderService } from "./order.service";
import { RequestWithUser } from "@/middleware/auth";
import { HTTPStatusCode } from "@/types/HTTPStatusCode";
import { AppError } from "@/core/errors/AppError";

export class OrderController {
    constructor(private orderService: OrderService) { }

    async getMyOrders(req: RequestWithUser, res: Response) {
        const userId = req.user!.id;
        const orders = await this.orderService.getUserOrders(userId);
        res.status(HTTPStatusCode.OK).json({ success: true, data: orders });
    }

    async getMyOrdersByStatus(req: RequestWithUser, res: Response) {
        const userId = req.user!.id;
        const { status } = req.query;

        let statusFilter: any = status;
        if (typeof status === 'string' && status.includes(',')) {
            statusFilter = status.split(',');
        }

        const orders = await this.orderService.getOrdersByStatus(userId, statusFilter);
        res.status(HTTPStatusCode.OK).json({ success: true, data: orders });
    }

    async getOrderCounts(req: RequestWithUser, res: Response) {
        const userId = req.user!.id;
        const counts = await this.orderService.getOrderCounts(userId);
        res.status(HTTPStatusCode.OK).json({ success: true, data: counts });
    }

    async getOrderDetails(req: RequestWithUser, res: Response) {
        const userId = req.user!.id;
        const { id } = req.params;

        const order = await this.orderService.getOrderById(id, userId);
        if (!order) {
            throw new AppError(HTTPStatusCode.NOT_FOUND, "Order not found");
        }

        res.status(HTTPStatusCode.OK).json({ success: true, data: order });
    }

    async cancelOrder(req: RequestWithUser, res: Response) {
        const userId = req.user!.id;
        const { id } = req.params;
        const order = await this.orderService.cancelOrder(userId, id);
        res.status(HTTPStatusCode.OK).json({
            success: true,
            message: "Order cancelled successfully",
            data: order
        });
    }

    async placeOrder(req: RequestWithUser, res: Response) {
        const userId = req.user!.id;
        const order = await this.orderService.placeOrder(userId, req.body);
        res.status(HTTPStatusCode.CREATED).json({
            success: true,
            message: "Order placed successfully",
            data: order
        });
    }

    async trackOrder(req: RequestWithUser, res: Response) {
        const { orderNumber } = req.params;
        const order = await this.orderService.getOrderByNumber(orderNumber);

        if (!order) {
            throw new AppError(HTTPStatusCode.NOT_FOUND, "Order not found");
        }

        res.status(HTTPStatusCode.OK).json({ success: true, data: order });
    }
}
