import { Router, Response } from "express";
import { ProfileController } from "./profile.controller";
import { validateRequest } from "@/middleware/validation";
import { asyncHandler } from "@/middleware/asyncHandler";
import { authenticate, RequestWithUser } from "@/middleware/auth";
import { ProfileValidation } from "./profile.validation";

export class ProfileRoutes {
    private router: Router;

    constructor(private profileController: ProfileController) {
        this.router = Router();
        this.initializeRoutes();
    }

    private initializeRoutes(): void {
        this.router.use(authenticate);

        this.router.get(
            "/me",
            asyncHandler((req: RequestWithUser, res: Response) =>
                this.profileController.getProfile(req, res),
            ),
        );

        this.router.patch(
            "/update",
            validateRequest({ body: ProfileValidation.updateProfile }),
            asyncHandler((req: RequestWithUser, res: Response) =>
                this.profileController.updateProfile(req, res),
            ),
        );

        this.router.post(
            "/change-password",
            validateRequest({ body: ProfileValidation.changePassword }),
            asyncHandler((req: RequestWithUser, res: Response) =>
                this.profileController.changePassword(req, res),
            ),
        );
    }

    public getRouter(): Router {
        return this.router;
    }
}
