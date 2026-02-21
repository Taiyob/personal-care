import { Router, Response } from "express";
import { CartController } from "./cart.controller";
import { validateRequest } from "@/middleware/validation";
import { asyncHandler } from "@/middleware/asyncHandler";
import { authenticate, optionalAuth } from "@/middleware/auth";
import { CartValidation } from "./cart.validation";
import { RequestWithUser } from "@/middleware/auth";

export class CartRoutes {
  private router: Router;

  constructor(private cartController: CartController) {
    this.router = Router();
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    // ── Guest + Authenticated (optionalAuth) ───────────────────────────
    // optionalAuth: JWT decode করে যদি token থাকে, না থাকলেও চলে
    // Guest হলে guestCartId query/body তে পাঠাবে

    /**
     * GET /api/cart
     * Authenticated:  JWT header → user cart
     * Guest:          ?guestCartId=<uuid> → guest cart
     */
    this.router.get(
      "/",
      optionalAuth,
      validateRequest({ query: CartValidation.getCartQuery }),
      asyncHandler((req: RequestWithUser, res: Response) =>
        this.cartController.getCart(req, res),
      ),
    );

    /**
     * GET /api/cart/count
     * Cart badge count — works for both guest and user
     * Guest: ?guestCartId=<uuid>
     */
    this.router.get(
      "/count",
      optionalAuth,
      asyncHandler((req: RequestWithUser, res: Response) =>
        this.cartController.getCartCount(req, res),
      ),
    );

    /**
     * POST /api/cart/items
     * Body (authenticated): { productId, quantity? }
     * Body (guest):         { productId, quantity?, guestCartId }
     */
    this.router.post(
      "/items",
      optionalAuth,
      validateRequest({ body: CartValidation.addItem }),
      asyncHandler((req: RequestWithUser, res: Response) =>
        this.cartController.addToCart(req, res),
      ),
    );

    /**
     * PATCH /api/cart/items/:productId
     * Body (authenticated): { quantity }
     * Body (guest):         { quantity, guestCartId }
     */
    this.router.patch(
      "/items/:productId",
      optionalAuth,
      validateRequest({
        params: CartValidation.params.productId,
        body: CartValidation.updateQuantity,
      }),
      asyncHandler((req: RequestWithUser, res: Response) =>
        this.cartController.updateQuantity(req, res),
      ),
    );

    /**
     * DELETE /api/cart/items/:productId
     * Body (guest): { guestCartId }
     */
    this.router.delete(
      "/items/:productId",
      optionalAuth,
      validateRequest({
        params: CartValidation.params.productId,
        body: CartValidation.removeItem,
      }),
      asyncHandler((req: RequestWithUser, res: Response) =>
        this.cartController.removeFromCart(req, res),
      ),
    );

    /**
     * DELETE /api/cart
     * Authenticated:  clears user cart
     * Guest:          ?guestCartId=<uuid>
     */
    this.router.delete(
      "/",
      optionalAuth,
      asyncHandler((req: RequestWithUser, res: Response) =>
        this.cartController.clearCart(req, res),
      ),
    );

    // ── Authenticated only ─────────────────────────────────────────────

    /**
     * POST /api/cart/merge
     * Called right after login — merges guest cart into user cart.
     * Body: { guestCartId }
     *
     * Merge strategy:
     *   - Item exists in both → take higher quantity (capped at stock)
     *   - Item only in guest  → move to user cart
     *   - Guest cart deleted after merge
     */
    this.router.post(
      "/merge",
      authenticate,
      validateRequest({ body: CartValidation.mergeCart }),
      asyncHandler((req: RequestWithUser, res: Response) =>
        this.cartController.mergeCart(req, res),
      ),
    );
  }

  public getRouter(): Router {
    return this.router;
  }
}
