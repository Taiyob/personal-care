import { z } from "zod";

export const ProfileValidation = {
    updateProfile: z
        .object({
            firstName: z.string().min(2).max(50).trim().optional(),
            lastName: z.string().min(2).max(50).trim().optional(),
            displayName: z.string().max(100).trim().optional(),
            phone: z.string().min(10).max(15).trim().optional(),
            bio: z.string().max(500).trim().optional(),
            avatarUrl: z.string().url().optional(),
        })
        .strict(),

    changePassword: z
        .object({
            currentPassword: z.string().min(6),
            newPassword: z.string().min(6),
            confirmPassword: z.string().min(6),
        })
        .strict()
        .refine((data) => data.newPassword === data.confirmPassword, {
            message: "Passwords don't match",
            path: ["confirmPassword"],
        }),
};

export type UpdateProfileInput = z.infer<typeof ProfileValidation.updateProfile>;
export type ChangePasswordInput = z.infer<typeof ProfileValidation.changePassword>;
