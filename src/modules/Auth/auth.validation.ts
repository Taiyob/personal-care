import { z } from 'zod';

const passwordSchema = z
    .string()
    .min(8, 'Password must be at least 8 characters long')
    .max(128, 'Password must not exceed 128 characters')
    .regex(/^(?=.*[a-z])/, 'Password must contain at least one lowercase letter')
    .regex(/^(?=.*[A-Z])/, 'Password must contain at least one uppercase letter')
    .regex(/^(?=.*\d)/, 'Password must contain at least one number');

const emailSchema = z
    .string()
    .email('Invalid email address')
    .min(5, 'Email must be at least 5 characters')
    .max(255, 'Email must not exceed 255 characters')
    .toLowerCase()
    .trim();

const phoneSchema = z
    .string()
    .regex(
        /^(?:\+88)?01[3-9]\d{8}$/,
        'Please enter a valid phone number (e.g. 01XXXXXXXXX or +8801XXXXXXXXX)'
    )
    .trim();

const otpCodeSchema = z
    .string()
    .regex(/^\d{6}$/, 'OTP code must be exactly 6 digits')
    .transform((val) => val.trim());

const roleSchema = z.enum(['user', 'admin']);


export const AuthValidation = {
    /**
     * POST /api/auth/register
     * Image form: Name | Phone Number | Email Address | Password | Confirm Password
     */
    register: z
        .object({
            name: z
                .string()
                .min(2, 'Name must be at least 2 characters')
                .max(100, 'Name must not exceed 100 characters')
                .trim(),
            phone: phoneSchema,
            email: emailSchema,
            password: passwordSchema,
            confirmPassword: z.string().min(1, 'Please confirm your password'),
        })
        .strict()
        .refine((data) => data.password === data.confirmPassword, {
            message: 'Passwords do not match',
            path: ['confirmPassword'],
        })
        .transform((data) => {
            const { confirmPassword, ...rest } = data;
            // Split name → firstName + lastName for Prisma User model
            const parts = rest.name.trim().split(/\s+/);
            const firstName = parts[0];
            const lastName = parts.slice(1).join(' ') || parts[0];
            return { ...rest, firstName, lastName };
        }),

    /**
     * POST /api/auth/login
     * Image form: E-mail or Phone Number | Password | Remember me
     */
    login: z
        .object({
            identifier: z
                .string()
                .min(1, 'Email or phone number is required')
                .trim(),
            password: z.string().min(1, 'Password is required'),
            rememberMe: z.boolean().default(false),
        })
        .strict(),

    /**
     * POST /api/auth/verify-email
     */
    verifyEmail: z
        .object({
            email: emailSchema,
            code: otpCodeSchema,
        })
        .strict(),

    /**
     * POST /api/auth/resend-email-verification
     */
    resendEmailVerification: z
        .object({
            email: emailSchema,
        })
        .strict(),

    /**
     * POST /api/auth/forgot-password
     */
    forgotPassword: z
        .object({
            email: emailSchema,
        })
        .strict(),

    /**
     * POST /api/auth/verify-reset-password-OTP
     */
    verifyResetPasswordOTPInput: z
        .object({
            email: emailSchema,
            code: otpCodeSchema,
        })
        .strict(),

    /**
     * POST /api/auth/reset-password
     */
    resetPassword: z
        .object({
            email: emailSchema,
            newPassword: passwordSchema,
        })
        .strict(),

    /**
     * POST /api/auth/change-password
     */
    changePassword: z
        .object({
            currentPassword: z.string().min(1, 'Current password is required'),
            newPassword: passwordSchema,
            confirmNewPassword: z.string(),
        })
        .strict()
        .refine((data) => data.newPassword === data.confirmNewPassword, {
            message: 'New passwords do not match',
            path: ['confirmNewPassword'],
        })
        .refine((data) => data.currentPassword !== data.newPassword, {
            message: 'New password must be different from current password',
            path: ['newPassword'],
        })
        .transform((data) => {
            const { confirmNewPassword, ...rest } = data;
            return rest;
        }),

    /**
     * PATCH /api/auth/update-profile
     */
    updateProfile: z
        .object({
            firstName: z
                .string()
                .min(2, 'First name must be at least 2 characters')
                .max(100)
                .trim()
                .optional(),
            lastName: z
                .string()
                .min(2, 'Last name must be at least 2 characters')
                .max(100)
                .trim()
                .optional(),
            username: z.string().min(3).max(50).trim().optional(),
            phone: phoneSchema.optional(),
            bio: z.string().max(500).trim().optional(),
            avatarUrl: z.string().url('Avatar URL must be a valid URL').trim().optional(),
        })
        .strict(),

    /**
     * PUT /api/auth/users/:userId/role
     */
    updateRole: z
        .object({
            role: roleSchema,
        })
        .strict(),

    /**
     * POST /api/auth/refresh
     */
    refreshToken: z
        .object({
            token: z.string().min(1, 'Token is required').optional(),
        })
        .strict(),

    // Parameter schemas
    params: {
        userId: z.object({
            userId: z.string().uuid('User ID must be a valid UUID'),
        }),
    },
};

// ─── Inferred Types ───────────────────────────────────────────────────────────

export type RegisterInput = z.infer<typeof AuthValidation.register>;
export type LoginInput = z.infer<typeof AuthValidation.login>;
export type VerifyEmailInput = z.infer<typeof AuthValidation.verifyEmail>;
export type ResendEmailVerificationInput = z.infer<typeof AuthValidation.resendEmailVerification>;
export type ForgotPasswordInput = z.infer<typeof AuthValidation.forgotPassword>;
export type VerifyResetPasswordOTPInput = z.infer<typeof AuthValidation.verifyResetPasswordOTPInput>;
export type ResetPasswordInput = z.infer<typeof AuthValidation.resetPassword>;
export type ChangePasswordInput = z.infer<typeof AuthValidation.changePassword>;
export type UpdateProfileInput = z.infer<typeof AuthValidation.updateProfile>;
export type UpdateRoleInput = z.infer<typeof AuthValidation.updateRole>;
export type RefreshTokenInput = z.infer<typeof AuthValidation.refreshToken>;
export type UserIdParams = z.infer<typeof AuthValidation.params.userId>;