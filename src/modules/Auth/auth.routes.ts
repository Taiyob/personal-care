import { Router, Request, Response } from 'express';
import { AuthController } from './auth.controller';
import { validateRequest } from '@/middleware/validation';
import { asyncHandler } from '@/middleware/asyncHandler';
import { authenticate, authorize } from '@/middleware/auth';
import { AuthValidation } from './auth.validation';
import { uploadSingle } from '@/middleware/upload';

export class AuthRoutes {
    private router: Router;
    private authController: AuthController;

    constructor(authController: AuthController) {
        this.router = Router();
        this.authController = authController;
        this.initializeRoutes();
    }

    private initializeRoutes(): void {

        // ── Public routes ──────────────────────────────────────────────────

        /**
         * POST /api/auth/register
         * Body: { name, phone, email, password, confirmPassword }
         */
        this.router.post(
            '/register',
            validateRequest({ body: AuthValidation.register }),
            asyncHandler((req: Request, res: Response) =>
                this.authController.register(req, res)
            )
        );

        /**
         * POST /api/auth/login
         * Body: { identifier (email OR phone), password, rememberMe? }
         */
        this.router.post(
            '/login',
            validateRequest({ body: AuthValidation.login }),
            asyncHandler((req: Request, res: Response) =>
                this.authController.login(req, res)
            )
        );

        /**
         * POST /api/auth/verify-email
         * Body: { email, code }
         */
        this.router.post(
            '/verify-email',
            validateRequest({ body: AuthValidation.verifyEmail }),
            asyncHandler((req: Request, res: Response) =>
                this.authController.verifyEmail(req, res)
            )
        );

        /**
         * POST /api/auth/resend-email-verification
         * Body: { email }
         */
        this.router.post(
            '/resend-email-verification',
            validateRequest({ body: AuthValidation.resendEmailVerification }),
            asyncHandler((req: Request, res: Response) =>
                this.authController.resendEmailVerification(req, res)
            )
        );

        /**
         * POST /api/auth/forgot-password
         * Body: { email }
         */
        this.router.post(
            '/forgot-password',
            validateRequest({ body: AuthValidation.forgotPassword }),
            asyncHandler((req: Request, res: Response) =>
                this.authController.forgotPassword(req, res)
            )
        );

        /**
         * POST /api/auth/verify-reset-password-OTP
         * Body: { email, code }
         */
        this.router.post(
            '/verify-reset-password-OTP',
            validateRequest({ body: AuthValidation.verifyResetPasswordOTPInput }),
            asyncHandler((req: Request, res: Response) =>
                this.authController.verifyResetPasswordOTP(req, res)
            )
        );

        /**
         * POST /api/auth/reset-password
         * Body: { email, newPassword }
         */
        this.router.post(
            '/reset-password',
            validateRequest({ body: AuthValidation.resetPassword }),
            asyncHandler((req: Request, res: Response) =>
                this.authController.resetPassword(req, res)
            )
        );

        /**
         * POST /api/auth/refresh
         * Body: { token? } — also reads from cookie / Authorization header
         */
        this.router.post(
            '/refresh',
            validateRequest({ body: AuthValidation.refreshToken }),
            asyncHandler((req: Request, res: Response) =>
                this.authController.refreshToken(req, res)
            )
        );

        // ── Protected routes (JWT required) ───────────────────────────────

        /**
         * POST /api/auth/verify
         * Validates the current token and returns decoded info
         */
        this.router.post(
            '/verify',
            authenticate,
            asyncHandler((req: Request, res: Response) =>
                this.authController.verifyToken(req, res)
            )
        );

        /**
         * GET /api/auth/profile
         */
        this.router.get(
            '/profile',
            authenticate,
            asyncHandler((req: Request, res: Response) =>
                this.authController.getProfile(req, res)
            )
        );

        /**
         * POST /api/auth/logout
         */
        this.router.post(
            '/logout',
            authenticate,
            asyncHandler((req: Request, res: Response) =>
                this.authController.logout(req, res)
            )
        );

        /**
         * POST /api/auth/change-password
         * Body: { currentPassword, newPassword, confirmNewPassword }
         */
        this.router.post(
            '/change-password',
            authenticate,
            validateRequest({ body: AuthValidation.changePassword }),
            asyncHandler((req: Request, res: Response) =>
                this.authController.changePassword(req, res)
            )
        );

        /**
         * PATCH /api/auth/update-profile
         * multipart/form-data: { firstName?, lastName?, username?, phone?, bio? }
         * File: avatar (single image, optional)
         */
        this.router.patch(
            '/update-profile',
            authenticate,
            uploadSingle('avatar'),
            asyncHandler((req: Request, res: Response) =>
                this.authController.updateProfile(req, res)
            )
        );

        // ── Admin-only routes ──────────────────────────────────────────────

        /**
         * GET /api/auth/users
         * Query: ?page=1&limit=10
         */
        this.router.get(
            '/users',
            authenticate,
            authorize('admin'),
            asyncHandler((req: Request, res: Response) =>
                this.authController.getUsers(req, res)
            )
        );

        /**
         * PUT /api/auth/users/:userId/role
         * Body: { role }
         */
        this.router.put(
            '/users/:userId/role',
            authenticate,
            authorize('admin'),
            validateRequest({
                params: AuthValidation.params.userId,
                body: AuthValidation.updateRole,
            }),
            asyncHandler((req: Request, res: Response) =>
                this.authController.updateUserRole(req, res)
            )
        );

        /**
         * GET /api/auth/stats
         */
        this.router.get(
            '/stats',
            authenticate,
            authorize('admin'),
            asyncHandler((req: Request, res: Response) =>
                this.authController.getAuthStats(req, res)
            )
        );
    }

    public getRouter(): Router {
        return this.router;
    }
}