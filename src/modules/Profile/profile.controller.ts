import { Response } from "express";
import { ProfileService } from "./profile.service";
import { RequestWithUser } from "@/middleware/auth";
import { HTTPStatusCode } from "@/types/HTTPStatusCode";

export class ProfileController {
    constructor(private profileService: ProfileService) { }

    async getProfile(req: RequestWithUser, res: Response) {
        const userId = req.user!.id;
        const profile = await this.profileService.getProfile(userId);
        res.status(HTTPStatusCode.OK).json({ success: true, data: profile });
    }

    async updateProfile(req: RequestWithUser, res: Response) {
        const userId = req.user!.id;
        const profile = await this.profileService.updateProfile(userId, req.body);
        res.status(HTTPStatusCode.OK).json({
            success: true,
            message: "Profile updated successfully",
            data: profile
        });
    }

    async changePassword(req: RequestWithUser, res: Response) {
        const userId = req.user!.id;
        await this.profileService.changePassword(userId, req.body);
        res.status(HTTPStatusCode.OK).json({
            success: true,
            message: "Password changed successfully"
        });
    }
}
