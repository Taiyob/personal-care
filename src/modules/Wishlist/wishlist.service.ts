import { PrismaClient } from "@/generated/prisma/client";

export class WishlistService {
    constructor(private prisma: PrismaClient) { }

    async getWishlist(userId: string) {
        let wishlist = await this.prisma.wishlist.findUnique({
            where: { userId },
            include: { items: { include: { product: true } } },
        });

        if (!wishlist) {
            wishlist = await this.prisma.wishlist.create({
                data: { userId },
                include: { items: { include: { product: true } } },
            });
        }

        return wishlist;
    }

    async addToWishlist(userId: string, productId: string) {
        let wishlist = await this.prisma.wishlist.findUnique({
            where: { userId },
        });

        if (!wishlist) {
            wishlist = await this.prisma.wishlist.create({
                data: { userId },
            });
        }

        return this.prisma.wishlistItem.upsert({
            where: {
                wishlistId_productId: {
                    wishlistId: wishlist.id,
                    productId,
                },
            },
            update: {},
            create: {
                wishlistId: wishlist.id,
                productId,
            },
        });
    }

    async removeFromWishlist(userId: string, productId: string) {
        const wishlist = await this.prisma.wishlist.findUnique({
            where: { userId },
        });

        if (!wishlist) return null;

        return this.prisma.wishlistItem.delete({
            where: {
                wishlistId_productId: {
                    wishlistId: wishlist.id,
                    productId,
                },
            },
        });
    }
}
