import { CreateOrderInput } from "./order.validation";
import { HTTPStatusCode } from "@/types/HTTPStatusCode";
import { AppError } from "@/core/errors/AppError";
import { OrderStatus, PaymentMethod, PaymentStatus, PrismaClient } from "@/generated/prisma/client";

export class OrderService {
    constructor(private prisma: PrismaClient) { }

    async getUserOrders(userId: string) {
        return this.prisma.order.findMany({
            where: { userId },
            include: { items: { include: { product: true } } },
            orderBy: { createdAt: "desc" },
        });
    }

    async getOrdersByStatus(userId: string, status: OrderStatus | OrderStatus[]) {
        const statusFilter = Array.isArray(status) ? { in: status } : status;
        return this.prisma.order.findMany({
            where: { userId, status: statusFilter },
            include: { items: { include: { product: true } } },
            orderBy: { createdAt: "desc" },
        });
    }

    async getOrderCounts(userId: string) {
        const counts = await this.prisma.order.groupBy({
            by: ["status"],
            where: { userId },
            _count: true,
        });

        // Transform into a mapper for easier consumption
        const result: Record<string, number> = {
            pending: 0,
            confirmed: 0,
            processing: 0,
            shipped: 0,
            delivered: 0,
            cancelled: 0,
            returned: 0,
            refunded: 0,
        };

        counts.forEach((c) => {
            result[c.status] = c._count;
        });

        return result;
    }

    async getOrderById(id: string, userId: string) {
        return this.prisma.order.findFirst({
            where: { id, userId },
            include: {
                items: { include: { product: true } },
                address: true,
                payment: true
            },
        });
    }

    async getOrderByNumber(orderNumber: string) {
        return this.prisma.order.findUnique({
            where: { orderNumber },
            include: {
                items: { include: { product: true } },
                address: true,
                payment: true
            },
        });
    }

    async placeOrder(userId: string, data: CreateOrderInput) {
        return await this.prisma.$transaction(async (tx: any) => {
            // 1. Get user's cart
            const cart = await tx.cart.findUnique({
                where: { userId },
                include: { items: { include: { product: true } } },
            });

            if (!cart || (cart.items as any[]).length === 0) {
                throw new AppError(HTTPStatusCode.BAD_REQUEST, "Cart is empty");
            }

            // 2. Validate stock and calculate subtotal
            let subtotal = 0;
            for (const item of (cart.items as any[])) {
                if (item.product.stock < item.quantity) {
                    throw new AppError(HTTPStatusCode.BAD_REQUEST, `Insufficent stock for ${item.product.name}`);
                }
                subtotal += (item.product.discountPrice || item.product.price) * item.quantity;
            }

            // 3. Shipping charge calculation based on delivery option
            // Normal: 120, Express: 180 (values from UI image)
            const shippingAmount = data.deliveryOption === "express" ? 180 : 120;

            // 4. Coupon discount (Mock logic for now, can be extended later)
            let discountAmount = 0;
            if (data.couponCode) {
                // Example: logic to check coupon validity
                // For now, let's assume no discount unless we implement a Coupon module
            }

            const grandTotal = subtotal + shippingAmount - discountAmount;

            // 5. Generate unique order number
            const orderNumber = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

            // 6. Get Address Snapshot
            const address = await tx.address.findUnique({
                where: { id: data.addressId },
            });

            if (!address) {
                throw new AppError(HTTPStatusCode.NOT_FOUND, "Address not found");
            }

            // 7. Create Order
            const order = await tx.order.create({
                data: {
                    orderNumber,
                    userId,
                    status: OrderStatus.pending,
                    totalAmount: subtotal,
                    discountAmount,
                    shippingAmount,
                    grandTotal,
                    paymentMethod: data.paymentMethod as PaymentMethod,
                    paymentStatus: PaymentStatus.pending,
                    shippingAddressId: data.addressId,
                    shippingAddress: address as any, // Snapshot
                    billingAddress: address as any, // Snapshot (same for now)
                    items: {
                        create: (cart.items as any[]).map((item) => ({
                            productId: item.productId,
                            quantity: item.quantity,
                            price: item.product.price,
                            discount: item.product.price - (item.product.discountPrice || item.product.price),
                        })),
                    },
                },
            });

            // 7. Update Stock
            for (const item of (cart.items as any[])) {
                await tx.product.update({
                    where: { id: item.productId },
                    data: { stock: { decrement: item.quantity } },
                });
            }

            // 8. Clear Cart
            await tx.cartItem.deleteMany({
                where: { cartId: cart.id },
            });

            return order;
        });
    }

    async cancelOrder(userId: string, orderId: string) {
        const order = await this.prisma.order.findFirst({
            where: { id: orderId, userId },
        });

        if (!order) {
            throw new AppError(HTTPStatusCode.NOT_FOUND, "Order not found");
        }

        if (order.status !== OrderStatus.pending) {
            throw new AppError(
                HTTPStatusCode.BAD_REQUEST,
                "Only pending orders can be cancelled"
            );
        }

        return await this.prisma.$transaction(async (tx: any) => {
            // 1. Update order status
            const updatedOrder = await tx.order.update({
                where: { id: orderId },
                data: { status: OrderStatus.cancelled },
            });

            // 2. Restore stock
            const orderItems = await tx.orderItem.findMany({
                where: { orderId },
            });

            for (const item of orderItems) {
                await tx.product.update({
                    where: { id: item.productId },
                    data: { stock: { increment: item.quantity } },
                });
            }

            return updatedOrder;
        });
    }
}
