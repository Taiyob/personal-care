import { PrismaClient } from "@/generated/prisma/client";
import { CreateAddressInput, UpdateAddressInput } from "./address.validation";

export class AddressService {
    constructor(private prisma: PrismaClient) { }

    async getUserAddresses(userId: string) {
        return this.prisma.address.findMany({
            where: { userId },
            orderBy: { createdAt: "desc" },
        });
    }

    async getAddressById(id: string, userId: string) {
        return this.prisma.address.findFirst({
            where: { id, userId },
        });
    }

    async createAddress(userId: string, data: CreateAddressInput) {
        // If this is the user's first address, make it default
        const count = await this.prisma.address.count({ where: { userId } });
        const isDefault = count === 0 ? true : data.isDefault;

        // If setting as default, unset others first
        if (isDefault) {
            await this.prisma.address.updateMany({
                where: { userId, isDefault: true },
                data: { isDefault: false },
            });
        }

        return this.prisma.address.create({
            data: {
                ...data,
                userId,
                isDefault,
            },
        });
    }

    async updateAddress(id: string, userId: string, data: UpdateAddressInput) {
        // If setting as default, unset others first
        if (data.isDefault) {
            await this.prisma.address.updateMany({
                where: { userId, isDefault: true, id: { not: id } },
                data: { isDefault: false },
            });
        }

        return this.prisma.address.update({
            where: { id, userId },
            data,
        });
    }

    async deleteAddress(id: string, userId: string) {
        return this.prisma.address.delete({
            where: { id, userId },
        });
    }

    async setDefaultAddress(id: string, userId: string) {
        await this.prisma.address.updateMany({
            where: { userId, isDefault: true },
            data: { isDefault: false },
        });

        return this.prisma.address.update({
            where: { id, userId },
            data: { isDefault: true },
        });
    }
}
