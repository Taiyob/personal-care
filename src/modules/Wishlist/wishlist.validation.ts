import { z } from "zod";

export const WishlistValidation = {
    params: {
        productId: z.object({
            productId: z.string().uuid("Product ID must be a valid UUID"),
        }),
    },
};
