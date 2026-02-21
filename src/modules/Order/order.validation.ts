import { z } from "zod";

export const OrderValidation = {
    create: z
        .object({
            addressId: z.string().uuid("Shipping address ID must be a valid UUID"),
            paymentMethod: z.enum(["cod", "bkash", "nagad", "rocket", "stripe", "paypal", "card"]),
            deliveryOption: z.enum(["normal", "express"]),
            couponCode: z.string().max(50).trim().optional(),
            notes: z.string().max(500).trim().optional(),
        })
        .strict(),

    track: z
        .object({
            orderNumber: z.string().min(1),
        })
        .strict(),

    params: {
        id: z.object({ id: z.string().uuid("Order ID must be a valid UUID") }),
    },
};

export type CreateOrderInput = z.infer<typeof OrderValidation.create>;
