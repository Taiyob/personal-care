import { BaseModule } from '@/core/BaseModule';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { DashboardRoutes } from './dashboard.routes';

export class DashboardModule extends BaseModule {
    public readonly name = 'DashboardModule';
    public readonly version = '1.0.0';
    public readonly dependencies = [];

    private dashboardService!: DashboardService;
    private dashboardController!: DashboardController;
    private dashboardRoutes!: DashboardRoutes;

    protected async setupServices(): Promise<void> {
        this.dashboardService = new DashboardService(this.context.prisma);
    }

    protected async setupRoutes(): Promise<void> {
        this.dashboardController = new DashboardController(this.dashboardService);
        this.dashboardRoutes = new DashboardRoutes(this.dashboardController);
        this.router.use('/api/dashboard', this.dashboardRoutes.getRouter());
    }
}
