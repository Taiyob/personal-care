import { Router, Request, Response } from 'express';
import { DashboardController } from './dashboard.controller';
import { asyncHandler } from '@/middleware/asyncHandler';
import { authenticate, authorize } from '@/middleware/auth';

export class DashboardRoutes {
    private router: Router;

    constructor(private dashboardController: DashboardController) {
        this.router = Router();
        this.initializeRoutes();
    }

    private initializeRoutes(): void {
        this.router.get(
            '/stats',
            authenticate,
            authorize('admin'),
            asyncHandler((req: Request, res: Response) => this.dashboardController.getStats(req, res))
        );
    }

    public getRouter(): Router {
        return this.router;
    }
}
