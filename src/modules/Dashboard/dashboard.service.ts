import { PrismaClient } from '@/generated/prisma/client';

export class DashboardService {
    constructor(private prisma: PrismaClient) { }

    async getStats() {
        const [totalUsers, totalProducts, paidOrders] = await Promise.all([
            this.prisma.user.count(),
            this.prisma.product.count(),
            this.prisma.order.findMany({
                where: {
                    paymentStatus: 'paid',
                },
                select: {
                    totalAmount: true,
                },
            }),
        ]);

        const totalRevenue = paidOrders.reduce((sum: number, order: { totalAmount: number }) => sum + order.totalAmount, 0);

        return {
            totals: {
                totalUsers,
                totalPayments: totalRevenue,
                totalProducts,
            },
            growth: [],
            newClientsTrend: [],
            topClientsByEmployees: [],
            userActivity: { active: totalUsers, inactive: 0 },
            planDistribution: []
        };
    }
}
