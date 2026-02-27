import { Request, Response } from 'express';
import { BaseController } from '@/core/BaseController';
import { DashboardService } from './dashboard.service';
import { HTTPStatusCode } from '@/types/HTTPStatusCode';

export class DashboardController extends BaseController {
    constructor(private dashboardService: DashboardService) {
        super();
    }

    public getStats = async (req: Request, res: Response) => {
        this.logAction('getStats', req);
        const stats = await this.dashboardService.getStats();
        return this.sendResponse(res, 'Dashboard statistics retrieved successfully', HTTPStatusCode.OK, stats);
    };
}
