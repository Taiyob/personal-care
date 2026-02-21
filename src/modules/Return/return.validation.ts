import { z } from "zod";

export const ReturnValidation = {
    create: z
        .object({
            orderId: z.string().uuid("Order ID must be a valid UUID"),
            reason: z.string().min(10).max(1000).trim(),
            items: z.array(
                z.object({
                    orderItemId: z.string().uuid(),
                    quantity: z.number().int().min(1),
                })
            ).min(1),
        })
        .strict(),

    params: {
        id: z.object({ id: z.string().uuid("Return ID must be a valid UUID") }),
    },
};

export type CreateReturnInput = z.infer<typeof ReturnValidation.create>;
