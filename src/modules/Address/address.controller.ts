import { Response } from "express";
import { AddressService } from "./address.service";
import { RequestWithUser } from "@/middleware/auth";
import { HTTPStatusCode } from "@/types/HTTPStatusCode";
import { AppError } from "@/core/errors/AppError";

export class AddressController {
    constructor(private addressService: AddressService) { }

    async getAddresses(req: RequestWithUser, res: Response) {
        const userId = req.user!.id;
        const addresses = await this.addressService.getUserAddresses(userId);
        res.status(HTTPStatusCode.OK).json({ success: true, data: addresses });
    }

    async createAddress(req: RequestWithUser, res: Response) {
        const userId = req.user!.id;
        const address = await this.addressService.createAddress(userId, req.body);
        res.status(HTTPStatusCode.CREATED).json({ success: true, data: address });
    }

    async updateAddress(req: RequestWithUser, res: Response) {
        const userId = req.user!.id;
        const { id } = req.params;

        const existing = await this.addressService.getAddressById(id, userId);
        if (!existing) {
            throw new AppError(HTTPStatusCode.NOT_FOUND, "Address not found");
        }

        const address = await this.addressService.updateAddress(id, userId, req.body);
        res.status(HTTPStatusCode.OK).json({ success: true, data: address });
    }

    async deleteAddress(req: RequestWithUser, res: Response) {
        const userId = req.user!.id;
        const { id } = req.params;

        const existing = await this.addressService.getAddressById(id, userId);
        if (!existing) {
            throw new AppError(HTTPStatusCode.NOT_FOUND, "Address not found");
        }

        await this.addressService.deleteAddress(id, userId);
        res.status(HTTPStatusCode.OK).json({ success: true, message: "Address deleted successfully" });
    }

    async setDefaultAddress(req: RequestWithUser, res: Response) {
        const userId = req.user!.id;
        const { id } = req.params;

        const existing = await this.addressService.getAddressById(id, userId);
        if (!existing) {
            throw new AppError(HTTPStatusCode.NOT_FOUND, "Address not found");
        }

        const address = await this.addressService.setDefaultAddress(id, userId);
        res.status(HTTPStatusCode.OK).json({ success: true, data: address });
    }
}
