import { Router, Response } from "express";
import { AddressController } from "./address.controller";
import { validateRequest } from "@/middleware/validation";
import { asyncHandler } from "@/middleware/asyncHandler";
import { authenticate, RequestWithUser } from "@/middleware/auth";
import { AddressValidation } from "./address.validation";

export class AddressRoutes {
    private router: Router;

    constructor(private addressController: AddressController) {
        this.router = Router();
        this.initializeRoutes();
    }

    private initializeRoutes(): void {
        this.router.use(authenticate);

        this.router.get(
            "/",
            asyncHandler((req: RequestWithUser, res: Response) =>
                this.addressController.getAddresses(req, res),
            ),
        );

        this.router.post(
            "/",
            validateRequest({ body: AddressValidation.create }),
            asyncHandler((req: RequestWithUser, res: Response) =>
                this.addressController.createAddress(req, res),
            ),
        );

        this.router.put(
            "/:id",
            validateRequest({
                params: AddressValidation.params.id,
                body: AddressValidation.update,
            }),
            asyncHandler((req: RequestWithUser, res: Response) =>
                this.addressController.updateAddress(req, res),
            ),
        );

        this.router.delete(
            "/:id",
            validateRequest({ params: AddressValidation.params.id }),
            asyncHandler((req: RequestWithUser, res: Response) =>
                this.addressController.deleteAddress(req, res),
            ),
        );

        this.router.patch(
            "/:id/default",
            validateRequest({ params: AddressValidation.params.id }),
            asyncHandler((req: RequestWithUser, res: Response) =>
                this.addressController.setDefaultAddress(req, res),
            ),
        );
    }

    public getRouter(): Router {
        return this.router;
    }
}
