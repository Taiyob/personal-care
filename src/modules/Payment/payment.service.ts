import { PrismaClient, PaymentMethod, PaymentStatus } from "@/generated/prisma/client";
import { AuthenticationError, BadRequestError, NotFoundError, DatabaseError } from "@/core/errors/AppError";
import Stripe from "stripe";
import { config } from "@/core/config";

const stripe = new Stripe(config.stripe.secretKey);

export class PaymentService {
    constructor(private prisma: PrismaClient) { }

    async createCheckoutSession(userId: string, orderId: string) {
        const order = await this.prisma.order.findUnique({
            where: { id: orderId, userId },
            include: { items: { include: { product: true } } }
        });

        if (!order) throw new NotFoundError("Order not found");
        if (order.paymentStatus === 'paid') throw new BadRequestError("Order already paid");

        // Create Stripe checkout session
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                ...order.items.map((item: any) => ({
                    price_data: {
                        currency: 'bdt', // Set currency appropriate for the app
                        product_data: {
                            name: item.product.name,
                        },
                        unit_amount: Math.round((item.price - item.discount) * 100), // Consider discount effectively matching subtotal
                    },
                    quantity: item.quantity,
                })),
                ...(order.shippingAmount ? [{
                    price_data: {
                        currency: 'bdt',
                        product_data: {
                            name: 'Delivery Charge',
                        },
                        unit_amount: Math.round(order.shippingAmount * 100),
                    },
                    quantity: 1,
                }] : [])
            ],
            mode: 'payment',
            success_url: `${config.client.url}/order?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${config.client.url}/checkout/cancel`,
            metadata: {
                orderId: order.id,
                userId: userId,
            }
        });

        if (!session.url) {
            throw new DatabaseError("Failed to generate stripe checkout session");
        }

        return { url: session.url };
    }

    async handleWebhook(body: string | Buffer, signature: string) {
        let event: Stripe.Event;
        try {
            event = stripe.webhooks.constructEvent(body, signature, config.stripe.webhookSecret);
        } catch (err: any) {
            throw new BadRequestError(`Webhook Error: ${err.message}`);
        }

        if (event.type === 'checkout.session.completed') {
            const session = event.data.object as Stripe.Checkout.Session;
            const orderId = session.metadata?.orderId;
            const userId = session.metadata?.userId;

            if (orderId && userId) {
                await this.prisma.$transaction(async (tx: any) => {
                    await tx.order.update({
                        where: { id: orderId },
                        data: {
                            paymentStatus: PaymentStatus.paid,
                            paymentMethod: PaymentMethod.stripe,
                        }
                    });

                    await tx.payment.create({
                        data: {
                            orderId: orderId,
                            userId: userId,
                            amount: session.amount_total ? session.amount_total / 100 : 0,
                            method: PaymentMethod.stripe,
                            status: PaymentStatus.paid,
                            transactionId: session.payment_intent as string,
                            paymentGateway: 'stripe',
                            paidAt: new Date()
                        }
                    });
                });
            }
        }
        return { received: true };
    }

    async getMyPayments(userId: string) {
        return this.prisma.payment.findMany({
            where: { userId },
            include: {
                order: {
                    include: {
                        items: {
                            include: {
                                product: { select: { name: true, images: true, price: true } }
                            }
                        }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
    }
}
