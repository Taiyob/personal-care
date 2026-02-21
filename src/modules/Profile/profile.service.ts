import { PrismaClient } from "@/generated/prisma/client";
import { UpdateProfileInput, ChangePasswordInput } from "./profile.validation";
import { HTTPStatusCode } from "@/types/HTTPStatusCode";
import { AppError } from "@/core/errors/AppError";
import bcrypt from "bcrypt";

export class ProfileService {
    constructor(private prisma: PrismaClient) { }

    async getProfile(userId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                username: true,
                firstName: true,
                lastName: true,
                displayName: true,
                phone: true,
                bio: true,
                avatarUrl: true,
                role: true,
                status: true,
                createdAt: true,
            },
        });

        if (!user) {
            throw new AppError(HTTPStatusCode.NOT_FOUND, "User not found");
        }

        return user;
    }

    async updateProfile(userId: string, data: UpdateProfileInput) {
        return this.prisma.user.update({
            where: { id: userId },
            data,
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                displayName: true,
                phone: true,
                avatarUrl: true,
            },
        });
    }

    async changePassword(userId: string, data: ChangePasswordInput) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            throw new AppError(HTTPStatusCode.NOT_FOUND, "User not found");
        }

        const isMatch = await bcrypt.compare(data.currentPassword, user.password);
        if (!isMatch) {
            throw new AppError(HTTPStatusCode.BAD_REQUEST, "Current password is incorrect");
        }

        const hashedPassword = await bcrypt.hash(data.newPassword, 10);

        return this.prisma.user.update({
            where: { id: userId },
            data: { password: hashedPassword },
        });
    }
}
