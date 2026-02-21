import { BaseModule } from "@/core/BaseModule";
import { ProfileService } from "./profile.service";
import { ProfileController } from "./profile.controller";
import { ProfileRoutes } from "./profile.routes";

export class ProfileModule extends BaseModule {
    public readonly name = "ProfileModule";
    public readonly version = "1.0.0";
    public readonly dependencies = ["AuthModule"];

    private profileService!: ProfileService;
    private profileController!: ProfileController;
    private profileRoutes!: ProfileRoutes;

    protected async setupServices(): Promise<void> {
        this.profileService = new ProfileService(this.context.prisma);
    }

    protected async setupRoutes(): Promise<void> {
        this.profileController = new ProfileController(this.profileService);
        this.profileRoutes = new ProfileRoutes(this.profileController);

        this.router.use("/api/profile", this.profileRoutes.getRouter());
    }
}
