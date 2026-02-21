import { Response } from "express";
import { ReturnService } from "./return.service";
import { RequestWithUser } from "@/middleware/auth";
import { HTTPStatusCode } from "@/types/HTTPStatusCode";

export class ReturnController {
    constructor(private returnService: ReturnService) { }

    async getMyReturns(req: RequestWithUser, res: Response) {
        const userId = req.user!.id;
        const returns = await this.returnService.getUserReturns(userId);
        res.status(HTTPStatusCode.OK).json({ success: true, data: returns });
    }

    async getReturnDetails(req: RequestWithUser, res: Response) {
        const userId = req.user!.id;
        const { id } = req.params;
        const returnDetails = await this.returnService.getReturnById(id, userId);
        res.status(HTTPStatusCode.OK).json({ success: true, data: returnDetails });
    }

    async submitReturn(req: RequestWithUser, res: Response) {
        const userId = req.user!.id;
        const returnRequest = await this.returnService.submitReturnRequest(userId, req.body);
        res.status(HTTPStatusCode.CREATED).json({
            success: true,
            message: "Return request submitted successfully",
            data: returnRequest
        });
    }
}
