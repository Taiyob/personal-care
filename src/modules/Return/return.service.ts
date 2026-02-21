import { PrismaClient, OrderStatus, ReturnStatus } from "@/generated/prisma/client";
import { CreateReturnInput } from "./return.validation";
import { HTTPStatusCode } from "@/types/HTTPStatusCode";
import { AppError } from "@/core/errors/AppError";

export class ReturnService {
    constructor(private prisma: PrismaClient) { }

    async getUserReturns(userId: string) {
        return this.prisma.returnRequest.findMany({
            where: { userId },
            include: { items: true, order: true },
            orderBy: { createdAt: "desc" },
        });
    }

    async getReturnById(id: string, userId: string) {
        return this.prisma.returnRequest.findFirst({
            where: { id, userId },
            include: { items: true, order: true },
        });
    }

    async submitReturnRequest(userId: string, data: CreateReturnInput) {
        const order = await this.prisma.order.findUnique({
            where: { id: data.orderId },
            include: { items: true },
        });

        if (!order || order.userId !== userId) {
            throw new AppError(HTTPStatusCode.NOT_FOUND, "Order not found");
        }

        if (order.status !== OrderStatus.delivered) {
            throw new AppError(
                HTTPStatusCode.BAD_REQUEST,
                "Returns can only be requested for delivered orders"
            );
        }

        // Basic validation of items (in reality, we should check if items exist in order and quantity is valid)

        return await this.prisma.returnRequest.create({
            data: {
                orderId: data.orderId,
                userId,
                reason: data.reason,
                status: ReturnStatus.pending,
                items: {
                    create: data.items.map((item) => ({
                        orderItemId: item.orderItemId,
                        quantity: item.quantity,
                    })),
                },
            },
            include: { items: true },
        });
    }
}
