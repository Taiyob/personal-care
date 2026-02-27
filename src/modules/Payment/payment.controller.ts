import { Response, Request } from "express";
import { RequestWithUser } from "@/middleware/auth";
import { AuthenticationError, BadRequestError } from "@/core/errors/AppError";
import { PaymentService } from "./payment.service";

export class PaymentController {
    constructor(private paymentService: PaymentService) { }

    createCheckoutSession = async (req: RequestWithUser, res: Response) => {
        const userId = req.user?.id;
        const { orderId } = req.body;

        if (!userId) throw new AuthenticationError("User not authenticated");
        if (!orderId) throw new BadRequestError("orderId is required");

        const result = await this.paymentService.createCheckoutSession(userId, orderId);
        res.status(200).json({ success: true, url: result.url });
    }

    stripeWebhook = async (req: Request, res: Response) => {
        const signature = req.headers["stripe-signature"] as string;
        // In IgnitorApp, raw body is saved to req.rawBody inside json parser 'verify'
        const rawBody = (req as any).rawBody || req.body;

        const result = await this.paymentService.handleWebhook(rawBody, signature);
        res.status(200).json(result);
    }

    getMyPayments = async (req: RequestWithUser, res: Response) => {
        const userId = req.user?.id;
        if (!userId) throw new AuthenticationError("User not authenticated");

        const payments = await this.paymentService.getMyPayments(userId);
        res.status(200).json({ success: true, data: payments });
    }
}
