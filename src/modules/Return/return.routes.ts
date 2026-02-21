import { Router, Response } from "express";
import { ReturnController } from "./return.controller";
import { validateRequest } from "@/middleware/validation";
import { asyncHandler } from "@/middleware/asyncHandler";
import { authenticate, RequestWithUser } from "@/middleware/auth";
import { ReturnValidation } from "./return.validation";

export class ReturnRoutes {
    private router: Router;

    constructor(private returnController: ReturnController) {
        this.router = Router();
        this.initializeRoutes();
    }

    private initializeRoutes(): void {
        this.router.use(authenticate);

        this.router.get(
            "/",
            asyncHandler((req: RequestWithUser, res: Response) =>
                this.returnController.getMyReturns(req, res),
            ),
        );

        this.router.post(
            "/",
            validateRequest({ body: ReturnValidation.create }),
            asyncHandler((req: RequestWithUser, res: Response) =>
                this.returnController.submitReturn(req, res),
            ),
        );

        this.router.get(
            "/:id",
            validateRequest({ params: ReturnValidation.params.id }),
            asyncHandler((req: RequestWithUser, res: Response) =>
                this.returnController.getReturnDetails(req, res),
            ),
        );
    }

    public getRouter(): Router {
        return this.router;
    }
}
