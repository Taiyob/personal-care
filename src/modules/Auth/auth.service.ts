import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { BaseService } from '@/core/BaseService';
import { AppLogger } from '@/core/logging/logger';
import {
    AuthenticationError,
    ConflictError,
    NotFoundError,
    BadRequestError,
} from '@/core/errors/AppError';
import { config } from '@/core/config';
import { JWTPayload } from '@/middleware/auth';
import { SESEmailService } from '@/services/SESEmailService';
import { OTPService, OTPType } from '../../services/otp.service';
import {
    ForgotPasswordInput,
    LoginInput,
    RegisterInput,
    ResendEmailVerificationInput,
    ResetPasswordInput,
    UpdateProfileInput,
    VerifyEmailInput,
    VerifyResetPasswordOTPInput,
} from './auth.validation';
import { AccountStatus, PrismaClient, User, UserRole } from '@/generated/prisma/client';

export interface AuthResponse {
    user: Omit<User, 'password'>;
    token: string;
    expiresIn: string;
}

export interface TokenInfo {
    userId: string;
    email: string;
    role: string;
}

export class AuthService extends BaseService<User> {
    private readonly SALT_ROUNDS = 12;
    private otpService: OTPService;

    constructor(prisma: PrismaClient) {
        super(prisma, 'User', {
            enableSoftDelete: true,
            enableAuditFields: true,
        });

        this.otpService = new OTPService(this.prisma, new SESEmailService());
    }

    protected getModel() {
        return this.prisma.user;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // REGISTER
    // Body (from image): name, phone, email, password, confirmPassword
    // validation.ts transform() splits name → firstName + lastName
    // ─────────────────────────────────────────────────────────────────────────
    async register(
        data: RegisterInput
    ): Promise<{ message: string; requiresVerification: boolean }> {
        const { firstName, lastName, name, phone, email, password } = data as any;

        // Check for existing email
        const existingEmail = await this.prisma.user.findUnique({ where: { email } });
        if (existingEmail) {
            throw new ConflictError('An account with this email already exists');
        }

        // Check for existing phone
        const existingPhone = await this.prisma.user.findUnique({ where: { phone } });
        if (existingPhone) {
            throw new ConflictError('An account with this phone number already exists');
        }

        const hashedPassword = await this.hashPassword(password);

        const user = await this.create({
            email,
            phone,
            password: hashedPassword,
            firstName,
            lastName,
            displayName: `${firstName} ${lastName}`,
            role: UserRole.user,
            status: AccountStatus.pending_verification,
        });

        // Send verification OTP (fire-and-forget, don't block response)
        this.otpService
            .sendOTP({
                identifier: email,
                type: OTPType.email_verification,
                userId: user.id,
            })
            .catch((error) => {
                AppLogger.error('Failed to send verification email after registration', {
                    userId: user.id,
                    email: user.email,
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            });

        AppLogger.info('User registered successfully', { userId: user.id, email: user.email });

        return {
            message: 'Registration successful. Please check your email for the verification code.',
            requiresVerification: true,
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // LOGIN
    // identifier = email OR phone number (as shown in the image)
    // ─────────────────────────────────────────────────────────────────────────
    async login(data: LoginInput): Promise<AuthResponse & { warning?: string }> {
        const { identifier, password, rememberMe } = data;

        // Determine if identifier is an email or phone
        const isEmail = identifier.includes('@');

        const user = await this.prisma.user.findFirst({
            where: isEmail
                ? { email: identifier, isDeleted: false }
                : { phone: identifier, isDeleted: false },
        });

        if (!user) {
            throw new AuthenticationError('Invalid email/phone or password');
        }

        // Account status checks
        if (user.status === AccountStatus.suspended) {
            throw new AuthenticationError(
                'Your account has been suspended. Please contact support.'
            );
        }

        if (user.status === AccountStatus.inactive) {
            throw new AuthenticationError(
                'Your account is inactive. Please contact support.'
            );
        }

        const isValidPassword = await this.verifyPassword(password, user.password);
        if (!isValidPassword) {
            AppLogger.warn('Failed login attempt', {
                identifier: isEmail ? user.email : user.phone,
                userId: user.id,
            });
            throw new AuthenticationError('Invalid email/phone or password');
        }

        // Update last login
        await this.updateById(user.id, { lastLoginAt: new Date() });

        AppLogger.info('User logged in successfully', {
            userId: user.id,
            email: user.email,
            role: user.role,
        });

        const authResponse = this.generateAuthResponse(user, rememberMe);

        // Warn if email not yet verified (allow login but warn)
        let warning: string | undefined;
        if (user.status === AccountStatus.pending_verification) {
            warning =
                'Your email is not yet verified. Some features may be restricted.';
        }

        return { ...authResponse, warning };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // VERIFY EMAIL
    // ─────────────────────────────────────────────────────────────────────────
    async verifyEmail(data: VerifyEmailInput): Promise<AuthResponse> {
        const { email, code } = data;

        const user = await this.findOne({ email });
        if (!user) {
            throw new NotFoundError('User not found');
        }

        if (user.status === AccountStatus.active) {
            throw new BadRequestError('Email is already verified');
        }

        const otpResult = await this.otpService.verifyOTP({
            identifier: email,
            code,
            type: OTPType.email_verification,
        });

        if (!otpResult.success) {
            throw new BadRequestError('Invalid or expired verification code');
        }

        const updatedUser = await this.updateById(user.id, {
            status: AccountStatus.active,
            emailVerifiedAt: new Date(),
        });

        AppLogger.info('Email verified successfully', { userId: user.id, email: user.email });

        return this.generateAuthResponse(updatedUser);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // RESEND EMAIL VERIFICATION
    // ─────────────────────────────────────────────────────────────────────────
    async resendEmailVerification(
        data: ResendEmailVerificationInput
    ): Promise<{ message: string }> {
        const { email } = data;

        const user = await this.findOne({ email });
        if (!user) {
            throw new NotFoundError('User');
        }

        if (user.status === AccountStatus.active) {
            throw new BadRequestError('Email is already verified');
        }

        await this.otpService.sendOTP({
            identifier: email,
            type: OTPType.email_verification,
            userId: user.id,
        });

        AppLogger.info('Verification OTP resent', { userId: user.id, email: user.email });

        return { message: 'Verification code sent to your email' };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // FORGOT PASSWORD
    // ─────────────────────────────────────────────────────────────────────────
    async forgotPassword(data: ForgotPasswordInput): Promise<{ message: string }> {
        const { email } = data;

        const user = await this.findOne({ email });

        // Generic response for security (don't reveal if account exists)
        if (!user || user.status !== AccountStatus.active) {
            return {
                message:
                    'If an account with this email exists, you will receive a password reset code.',
            };
        }

        this.otpService
            .sendOTP({
                identifier: email,
                type: OTPType.password_reset,
                userId: user.id,
            })
            .catch((error) => {
                AppLogger.error('Failed to send password reset OTP', {
                    userId: user.id,
                    email: user.email,
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            });

        return {
            message:
                'If an account with this email exists, you will receive a password reset code.',
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // VERIFY RESET PASSWORD OTP
    // ─────────────────────────────────────────────────────────────────────────
    async verifyResetPasswordOTP(data: VerifyResetPasswordOTPInput): Promise<{ message: string }> {
        const { email, code } = data;

        const user = await this.findOne({ email });
        if (!user) {
            throw new NotFoundError('User not found');
        }

        const otpResult = await this.otpService.verifyOTP({
            identifier: email,
            code,
            type: OTPType.password_reset,
        });

        if (!otpResult.success) {
            throw new BadRequestError('Invalid or expired reset code');
        }

        AppLogger.info('Password reset OTP verified', { userId: user.id, email: user.email });

        return { message: 'Code verified. You can now reset your password.' };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // RESET PASSWORD
    // ─────────────────────────────────────────────────────────────────────────
    async resetPassword(data: ResetPasswordInput): Promise<{ message: string }> {
        const { email, newPassword } = data;

        const user = await this.findOne({ email });
        if (!user) {
            throw new NotFoundError('User not found');
        }

        const hasVerifiedOTP = await this.hasVerifiedOTP(email, OTPType.password_reset);
        if (!hasVerifiedOTP) {
            throw new BadRequestError('Password reset code not verified or expired');
        }

        const hashedPassword = await this.hashPassword(newPassword);
        await this.updateById(user.id, { password: hashedPassword });

        await this.otpService.cleanupUserOTPs(email);

        AppLogger.info('Password reset completed', { userId: user.id, email: user.email });

        return { message: 'Password reset successfully. You can now log in.' };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CHANGE PASSWORD
    // ─────────────────────────────────────────────────────────────────────────
    async changePassword(
        userId: string,
        currentPassword: string,
        newPassword: string
    ): Promise<{ message: string }> {
        const user = await this.findById(userId);
        if (!user) {
            throw new NotFoundError('User not found');
        }

        const isValidPassword = await this.verifyPassword(currentPassword, user.password);
        if (!isValidPassword) {
            throw new AuthenticationError('Current password is incorrect');
        }

        const hashedNewPassword = await this.hashPassword(newPassword);
        await this.updateById(userId, { password: hashedNewPassword });

        AppLogger.info('Password changed successfully', { userId });

        return { message: 'Password changed successfully' };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET PROFILE
    // ─────────────────────────────────────────────────────────────────────────
    async getProfile(userId: string): Promise<Omit<User, 'password'>> {
        const user = await this.findById(userId);
        if (!user) {
            throw new NotFoundError('User not found');
        }

        const { password, ...userWithoutPassword } = user;
        return userWithoutPassword;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // UPDATE PROFILE
    // ─────────────────────────────────────────────────────────────────────────
    async updateProfile(userId: string, data: UpdateProfileInput): Promise<Omit<User, 'password'>> {
        const user = await this.findById(userId);
        if (!user) {
            throw new NotFoundError('User not found');
        }

        // Check phone uniqueness if being updated
        if (data.phone && data.phone !== user.phone) {
            const existingPhone = await this.prisma.user.findUnique({
                where: { phone: data.phone },
            });
            if (existingPhone) {
                throw new ConflictError('This phone number is already in use');
            }
        }

        const firstName = data.firstName ?? user.firstName;
        const lastName = data.lastName ?? user.lastName;
        const displayName = `${firstName} ${lastName}`;

        const updatedUser = await this.updateById(userId, {
            ...data,
            displayName,
        });

        AppLogger.info('User profile updated', { userId });

        const { password, ...userWithoutPassword } = updatedUser;
        return userWithoutPassword;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // UPDATE USER ROLE (admin only)
    // ─────────────────────────────────────────────────────────────────────────
    async updateUserRole(userId: string, newRole: UserRole): Promise<Omit<User, 'password'>> {
        const user = await this.findById(userId);
        if (!user) {
            throw new NotFoundError('User not found');
        }

        const updatedUser = await this.updateById(userId, { role: newRole });

        AppLogger.info('User role updated', { userId, oldRole: user.role, newRole });

        const { password, ...userWithoutPassword } = updatedUser;
        return userWithoutPassword;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // REFRESH TOKEN
    // ─────────────────────────────────────────────────────────────────────────
    async refreshToken(currentToken: string): Promise<AuthResponse> {
        try {
            if (!config.security.jwt.secret) {
                throw new AuthenticationError('JWT configuration missing');
            }

            const decoded = jwt.verify(currentToken, config.security.jwt.secret) as JWTPayload;
            const user = await this.findById(decoded.id);

            if (!user || user.status !== AccountStatus.active) {
                throw new AuthenticationError('Session invalid or account inactive');
            }

            return this.generateAuthResponse(user);
        } catch {
            throw new AuthenticationError('Invalid or expired refresh token');
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // VERIFY TOKEN
    // ─────────────────────────────────────────────────────────────────────────
    async verifyToken(token: string): Promise<TokenInfo> {
        try {
            if (!config.security.jwt.secret) {
                throw new AuthenticationError('JWT configuration missing');
            }

            const decoded = jwt.verify(token, config.security.jwt.secret) as JWTPayload;
            const user = await this.findById(decoded.id);

            if (!user || user.status !== AccountStatus.active) {
                throw new AuthenticationError('User not found or inactive');
            }

            return {
                userId: decoded.id,
                email: decoded.email,
                role: decoded.role,
            };
        } catch {
            throw new AuthenticationError('Invalid or expired token');
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET USERS (admin) - paginated via BaseService
    // ─────────────────────────────────────────────────────────────────────────
    async getUsers(pagination?: { page: number; limit: number; offset: number }) {
        return this.findMany({}, pagination, { createdAt: 'desc' });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // AUTH STATS (admin)
    // ─────────────────────────────────────────────────────────────────────────
    async getAuthStats() {
        const [total, active, adminCount] = await Promise.all([
            this.count(),
            this.count({ status: AccountStatus.active }),
            this.count({ role: UserRole.admin }),
        ]);

        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const recent = await this.count({ createdAt: { gte: weekAgo } });

        return {
            totalUsers: total,
            activeUsers: active,
            adminUsers: adminCount,
            regularUsers: total - adminCount,
            recentRegistrations: recent,
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PRIVATE HELPERS
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Generate JWT + build safe response (no password)
     * rememberMe → 30d, otherwise uses config default (1d)
     */
    private generateAuthResponse(user: User, rememberMe?: boolean): AuthResponse {
        if (!config.security.jwt.secret) {
            throw new AuthenticationError('JWT secret missing');
        }

        const payload: JWTPayload = {
            id: user.id,
            email: user.email,
            role: user.role,
        };

        const expiresIn = rememberMe ? '30d' : (config.security.jwt.expiresIn || '1d');

        // এখানে type assertion দাও
        const token = jwt.sign(
            payload,
            config.security.jwt.secret,
            {
                expiresIn: expiresIn as jwt.SignOptions['expiresIn'],  // ← এটা key fix
                // অথবা আরও safe: expiresIn: expiresIn as any,
            }
        );

        const { password, ...safeUser } = user;
        return { user: safeUser, token, expiresIn };
    }
    // private generateAuthResponse(user: User, rememberMe?: boolean): AuthResponse {
    //     if (!config.security.jwt.secret) {
    //         throw new AuthenticationError('JWT secret missing');
    //     }

    //     const payload: JWTPayload = {
    //         id: user.id,
    //         email: user.email,
    //         role: user.role,
    //     };

    //     const expiresIn = rememberMe ? '30d' : config.security.jwt.expiresIn || '1d';

    //     const token = jwt.sign(payload, config.security.jwt.secret, { expiresIn });

    //     const { password, ...safeUser } = user;
    //     return { user: safeUser, token, expiresIn };
    // }

    private async hashPassword(password: string): Promise<string> {
        return bcrypt.hash(password, this.SALT_ROUNDS);
    }

    private async verifyPassword(plain: string, hashed: string): Promise<boolean> {
        return bcrypt.compare(plain, hashed);
    }

    private async hasVerifiedOTP(identifier: string, type: OTPType): Promise<boolean> {
        const otp = await this.prisma.oTP.findFirst({
            where: { identifier, type, verified: true },
            orderBy: { createdAt: 'desc' },
        });
        return !!otp;
    }
}