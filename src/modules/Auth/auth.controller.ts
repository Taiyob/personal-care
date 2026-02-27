import { Request, Response } from 'express';
import { BaseController } from '@/core/BaseController';
import { AuthService } from './auth.service';
import { HTTPStatusCode } from '@/types/HTTPStatusCode';
import { MinioService } from '@/services/MinioService';
import { AuthValidation } from './auth.validation';

export class AuthController extends BaseController {
    constructor(private authService: AuthService) {
        super();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // POST /api/auth/register
    // Body: { name, phone, email, password, confirmPassword }
    // ─────────────────────────────────────────────────────────────────────────
    public register = async (req: Request, res: Response) => {
        const body = req.validatedBody || req.body;
        this.logAction('register', req, { email: body.email });

        const result = await this.authService.register(body);

        // Set HTTP-only cookie for auto-login
        if (result.token) {
            res.cookie('auth_token', result.token, {
                httpOnly: true,
                secure: true,
                sameSite: 'none',
                maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days default
                path: '/',
            });
        }

        return this.sendCreatedResponse(res, result, result.message);
    };

    // ─────────────────────────────────────────────────────────────────────────
    // POST /api/auth/login
    // Body: { identifier (email or phone), password, rememberMe? }
    // ─────────────────────────────────────────────────────────────────────────
    public login = async (req: Request, res: Response) => {
        const body = req.validatedBody || req.body;
        this.logAction('login', req, { identifier: body.identifier });

        const result = await this.authService.login(body);

        // Set HTTP-only cookie; extend to 30d if rememberMe
        const maxAge = body.rememberMe
            ? 30 * 24 * 60 * 60 * 1000   // 30 days
            : 7 * 24 * 60 * 60 * 1000;    // 7 days

        res.cookie('auth_token', result.token, {
            httpOnly: true,
            secure: true,
            sameSite: 'none',
            maxAge,
            path: '/',
        });

        // Separate warning from the main data so clients can surface it
        const { warning, ...data } = result;

        return this.sendResponse(
            res,
            warning ? `Login successful. ${warning}` : 'Login successful',
            HTTPStatusCode.OK,
            data
        );
    };

    // ─────────────────────────────────────────────────────────────────────────
    // POST /api/auth/verify-email
    // Body: { email, code }
    // ─────────────────────────────────────────────────────────────────────────
    public verifyEmail = async (req: Request, res: Response) => {
        const body = req.validatedBody || req.body;
        this.logAction('verifyEmail', req, { email: body.email });

        const result = await this.authService.verifyEmail(body);

        this.setAuthCookie(res, result.token);

        return this.sendResponse(
            res,
            'Email verified successfully. You are now logged in.',
            HTTPStatusCode.OK,
            result
        );
    };

    // ─────────────────────────────────────────────────────────────────────────
    // POST /api/auth/resend-email-verification
    // Body: { email }
    // ─────────────────────────────────────────────────────────────────────────
    public resendEmailVerification = async (req: Request, res: Response) => {
        const body = req.validatedBody || req.body;
        this.logAction('resendEmailVerification', req, { email: body.email });

        const result = await this.authService.resendEmailVerification(body);

        return this.sendResponse(res, result.message, HTTPStatusCode.OK, result);
    };

    // ─────────────────────────────────────────────────────────────────────────
    // POST /api/auth/forgot-password
    // Body: { email }
    // ─────────────────────────────────────────────────────────────────────────
    public forgotPassword = async (req: Request, res: Response) => {
        const body = req.validatedBody || req.body;
        this.logAction('forgotPassword', req, { email: body.email });

        const result = await this.authService.forgotPassword(body);

        return this.sendResponse(res, result.message, HTTPStatusCode.OK, result);
    };

    // ─────────────────────────────────────────────────────────────────────────
    // POST /api/auth/verify-reset-password-OTP
    // Body: { email, code }
    // ─────────────────────────────────────────────────────────────────────────
    public verifyResetPasswordOTP = async (req: Request, res: Response) => {
        const body = req.validatedBody || req.body;
        this.logAction('verifyResetPasswordOTP', req, { email: body.email });

        const result = await this.authService.verifyResetPasswordOTP(body);

        return this.sendResponse(res, result.message, HTTPStatusCode.OK, result);
    };

    // ─────────────────────────────────────────────────────────────────────────
    // POST /api/auth/reset-password
    // Body: { email, newPassword }
    // ─────────────────────────────────────────────────────────────────────────
    public resetPassword = async (req: Request, res: Response) => {
        const body = req.validatedBody || req.body;
        this.logAction('resetPassword', req, { email: body.email });

        const result = await this.authService.resetPassword(body);

        return this.sendResponse(res, result.message, HTTPStatusCode.OK, result);
    };

    // ─────────────────────────────────────────────────────────────────────────
    // POST /api/auth/logout
    // ─────────────────────────────────────────────────────────────────────────
    public logout = async (req: Request, res: Response) => {
        this.logAction('logout', req, { userId: this.getUserId(req) });

        this.clearAuthCookie(res);

        return this.sendResponse(res, 'Logout successful', HTTPStatusCode.OK);
    };

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/auth/profile
    // ─────────────────────────────────────────────────────────────────────────
    public getProfile = async (req: Request, res: Response) => {
        const userId = this.getUserId(req);
        if (!userId) {
            return this.sendResponse(res, 'User not authenticated', HTTPStatusCode.UNAUTHORIZED);
        }

        this.logAction('getProfile', req, { userId });

        const profile = await this.authService.getProfile(userId);

        return this.sendResponse(res, 'Profile retrieved successfully', HTTPStatusCode.OK, profile);
    };

    // ─────────────────────────────────────────────────────────────────────────
    // POST /api/auth/refresh
    // ─────────────────────────────────────────────────────────────────────────
    public refreshToken = async (req: Request, res: Response) => {
        const body = req.validatedBody || req.body;
        const currentToken =
            body?.token ||
            req.headers.authorization?.replace('Bearer ', '') ||
            req.cookies?.auth_token;

        if (!currentToken) {
            return this.sendResponse(res, 'Token is required', HTTPStatusCode.BAD_REQUEST);
        }

        this.logAction('refreshToken', req);

        const result = await this.authService.refreshToken(currentToken);

        this.setAuthCookie(res, result.token);

        return this.sendResponse(res, 'Token refreshed successfully', HTTPStatusCode.OK, result);
    };

    // ─────────────────────────────────────────────────────────────────────────
    // POST /api/auth/change-password
    // ─────────────────────────────────────────────────────────────────────────
    public changePassword = async (req: Request, res: Response) => {
        const userId = this.getUserId(req);
        if (!userId) {
            return this.sendResponse(res, 'User not authenticated', HTTPStatusCode.UNAUTHORIZED);
        }

        const body = req.validatedBody || req.body;
        this.logAction('changePassword', req, { userId });

        const result = await this.authService.changePassword(
            userId,
            body.currentPassword,
            body.newPassword
        );

        return this.sendResponse(res, result.message, HTTPStatusCode.OK, result);
    };

    // ─────────────────────────────────────────────────────────────────────────
    // PATCH /api/auth/update-profile
    // multipart/form-data: text fields + optional avatar file
    // ─────────────────────────────────────────────────────────────────────────
    public updateProfile = async (req: Request, res: Response) => {
        const userId = this.getUserId(req);
        if (!userId) {
            return this.sendResponse(res, 'User not authenticated', HTTPStatusCode.UNAUTHORIZED);
        }

        // Parse body — Zod validation (avatarUrl is optional string URL)
        const body = AuthValidation.updateProfile.parse(req.body);
        this.logAction('updateProfile', req, { userId });

        // Upload avatar file to MinIO if provided
        if (req.file) {
            // Delete old avatar if exists
            const currentUser = await this.authService.getProfile(userId);
            if (currentUser.avatarUrl) {
                await MinioService.deleteFile(currentUser.avatarUrl);
            }
            body.avatarUrl = await MinioService.uploadFile('avatars', req.file);
        }

        const updatedUser = await this.authService.updateProfile(userId, body);

        return this.sendResponse(
            res,
            'Profile updated successfully',
            HTTPStatusCode.OK,
            updatedUser
        );
    };

    // ─────────────────────────────────────────────────────────────────────────
    // PUT /api/auth/users/:userId/role  (admin only)
    // ─────────────────────────────────────────────────────────────────────────
    public updateUserRole = async (req: Request, res: Response) => {
        const params = req.validatedParams || req.params;
        const body = req.validatedBody || req.body;
        const { userId } = params;

        this.logAction('updateUserRole', req, {
            targetUserId: userId,
            currentUserId: this.getUserId(req),
            newRole: body.role,
        });

        const updatedUser = await this.authService.updateUserRole(userId, body.role);

        return this.sendResponse(
            res,
            'User role updated successfully',
            HTTPStatusCode.OK,
            updatedUser
        );
    };

    // ─────────────────────────────────────────────────────────────────────────
    // POST /api/auth/verify  (token validity check)
    // ─────────────────────────────────────────────────────────────────────────
    public verifyToken = async (req: Request, res: Response) => {
        const token =
            req.headers.authorization?.replace('Bearer ', '') ||
            req.body?.token ||
            req.cookies?.auth_token;

        if (!token) {
            return this.sendResponse(res, 'Token is required', HTTPStatusCode.BAD_REQUEST);
        }

        this.logAction('verifyToken', req);

        const tokenInfo = await this.authService.verifyToken(token);

        return this.sendResponse(res, 'Token is valid', HTTPStatusCode.OK, tokenInfo);
    };

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/auth/users  (admin only)
    // ─────────────────────────────────────────────────────────────────────────
    public getUsers = async (req: Request, res: Response) => {
        const pagination = this.extractPaginationParams(req);
        this.logAction('getUsers', req, { pagination });

        const result = await this.authService.getUsers(pagination);

        return this.sendPaginatedResponse(
            res,
            {
                page: result.page,
                limit: result.limit,
                total: result.total,
                totalPages: result.totalPages,
                hasNext: result.hasNext,
                hasPrevious: result.hasPrevious,
            },
            'Users retrieved successfully',
            result.data
        );
    };

    // ─────────────────────────────────────────────────────────────────────────
    // DELETE /api/auth/users/:userId (admin only)
    // ─────────────────────────────────────────────────────────────────────────
    public deleteUser = async (req: Request, res: Response) => {
        const { userId } = req.params;
        this.logAction('deleteUser', req, { targetUserId: userId });

        await this.authService.deleteUser(userId);
        return this.sendResponse(res, 'User deleted successfully', HTTPStatusCode.OK);
    };

    // ─────────────────────────────────────────────────────────────────────────
    // PATCH /api/auth/users/:userId/status (admin only)
    // ─────────────────────────────────────────────────────────────────────────
    public updateUserStatus = async (req: Request, res: Response) => {
        const { userId } = req.params;
        const { status } = req.body;
        this.logAction('updateUserStatus', req, { targetUserId: userId, status });

        const updatedUser = await this.authService.updateUserStatus(userId, status);
        return this.sendResponse(res, 'User status updated successfully', HTTPStatusCode.OK, updatedUser);
    };

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/auth/stats  (admin only)
    // ─────────────────────────────────────────────────────────────────────────
    public getAuthStats = async (req: Request, res: Response) => {
        this.logAction('getAuthStats', req);

        const stats = await this.authService.getAuthStats();

        return this.sendResponse(
            res,
            'Authentication statistics retrieved successfully',
            HTTPStatusCode.OK,
            stats
        );
    };
}