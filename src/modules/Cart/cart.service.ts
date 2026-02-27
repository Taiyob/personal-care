import { BaseService } from "@/core/BaseService";
import { AppLogger } from "@/core/logging/logger";
import { NotFoundError, BadRequestError } from "@/core/errors/AppError";
import { Cart, PrismaClient } from "@/generated/prisma/client";
import {
  AddToCartInput,
  UpdateCartQuantityInput,
  MergeCartInput,
  RemoveItemInput,
} from "./cart.validation";

// ─── Shared include ───────────────────────────────────────────────────────────
const CART_INCLUDE = {
  items: {
    orderBy: { createdAt: "asc" as const },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          price: true,
          discountPrice: true,
          stock: true,
          featuredImage: true,
          status: true,
        },
      },
    },
  },
};

export class CartService extends BaseService<Cart> {
  constructor(prisma: PrismaClient) {
    super(prisma, "Cart", { enableAuditFields: true });
  }

  protected getModel() {
    return this.prisma.cart;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // INTERNAL: Resolve cart by userId (authenticated) OR guestCartId (guest)
  //
  // Cart schema uses:
  //   userId        → for logged-in users (unique, FK to User)
  //   guestCartId   → for guests (unique UUID, no FK)
  //
  // If neither exists → create a new guest cart using the provided guestCartId
  // ─────────────────────────────────────────────────────────────────────────
  private async resolveCart(userId?: string, guestCartId?: string) {
    if (userId) {
      // Logged-in user cart
      let cart = await this.prisma.cart.findUnique({
        where: { userId },
        include: CART_INCLUDE,
      });

      if (!cart) {
        cart = await this.prisma.cart.create({
          data: { userId },
          include: CART_INCLUDE,
        });
        AppLogger.info("Cart created for user", { userId });
      }

      return cart;
    }

    if (guestCartId) {
      // Guest cart — find or create by guestCartId
      let cart = await this.prisma.cart.findUnique({
        where: { guestCartId },
        include: CART_INCLUDE,
      });

      if (!cart) {
        cart = await this.prisma.cart.create({
          data: { guestCartId },
          include: CART_INCLUDE,
        });
        AppLogger.info("Guest cart created", { guestCartId });
      }

      return cart;
    }

    throw new BadRequestError(
      "Either authentication token or guestCartId is required",
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GET CART
  // ─────────────────────────────────────────────────────────────────────────
  async getCart(userId?: string, guestCartId?: string) {
    const cart = await this.resolveCart(userId, guestCartId);
    return this.buildCartResponse(cart);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ADD TO CART
  // ─────────────────────────────────────────────────────────────────────────
  async addToCart(data: AddToCartInput, userId?: string) {
    const { productId, quantity, guestCartId } = data;

    // Validate product
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product || product.status !== "active") {
      throw new NotFoundError("Product not found or unavailable");
    }
    if (product.stock < 1) {
      throw new BadRequestError("This product is out of stock");
    }

    const cart = await this.resolveCart(userId, guestCartId);

    // Existing item → increment
    const existingItem = await this.prisma.cartItem.findUnique({
      where: { cartId_productId: { cartId: cart.id, productId } },
    });

    if (existingItem) {
      const newQty = existingItem.quantity + quantity;
      if (newQty > product.stock) {
        throw new BadRequestError(
          `Only ${product.stock} unit(s) available. You already have ${existingItem.quantity} in your cart.`,
        );
      }
      await this.prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: newQty },
      });
    } else {
      if (quantity > product.stock) {
        throw new BadRequestError(`Only ${product.stock} unit(s) available`);
      }
      await this.prisma.cartItem.create({
        data: { cartId: cart.id, productId, quantity },
      });
    }

    AppLogger.info("Item added to cart", {
      cartId: cart.id,
      productId,
      quantity,
      isGuest: !userId,
    });

    const updated = await this.prisma.cart.findUnique({
      where: { id: cart.id },
      include: CART_INCLUDE,
    });

    return this.buildCartResponse(updated!);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // UPDATE QUANTITY
  // ─────────────────────────────────────────────────────────────────────────
  async updateQuantity(
    productId: string,
    data: UpdateCartQuantityInput,
    userId?: string,
  ) {
    const cart = await this.resolveCart(userId, data.guestCartId);

    const cartItem = await this.prisma.cartItem.findUnique({
      where: { cartId_productId: { cartId: cart.id, productId } },
      include: { product: { select: { stock: true, name: true } } },
    });

    if (!cartItem) throw new NotFoundError("Item not found in cart");

    if (data.quantity > cartItem.product.stock) {
      throw new BadRequestError(
        `Only ${cartItem.product.stock} unit(s) of "${cartItem.product.name}" are available`,
      );
    }

    await this.prisma.cartItem.update({
      where: { id: cartItem.id },
      data: { quantity: data.quantity },
    });

    const updated = await this.prisma.cart.findUnique({
      where: { id: cart.id },
      include: CART_INCLUDE,
    });

    return this.buildCartResponse(updated!);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // REMOVE FROM CART
  // ─────────────────────────────────────────────────────────────────────────
  async removeFromCart(
    productId: string,
    data: RemoveItemInput,
    userId?: string,
  ) {
    const cart = await this.resolveCart(userId, data.guestCartId);

    const cartItem = await this.prisma.cartItem.findUnique({
      where: { cartId_productId: { cartId: cart.id, productId } },
    });

    if (!cartItem) throw new NotFoundError("Item not found in cart");

    await this.prisma.cartItem.delete({ where: { id: cartItem.id } });

    const updated = await this.prisma.cart.findUnique({
      where: { id: cart.id },
      include: CART_INCLUDE,
    });

    return this.buildCartResponse(updated!);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CLEAR CART
  // ─────────────────────────────────────────────────────────────────────────
  async clearCart(userId?: string, guestCartId?: string) {
    const cart = await this.resolveCart(userId, guestCartId);

    await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } });

    AppLogger.info("Cart cleared", { cartId: cart.id, isGuest: !userId });

    return { message: "Cart cleared successfully", itemCount: 0, subtotal: 0 };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GET CART COUNT  (for navbar badge)
  // ─────────────────────────────────────────────────────────────────────────
  async getCartCount(
    userId?: string,
    guestCartId?: string,
  ): Promise<{ count: number }> {
    let cart: Cart | null = null;

    if (userId) {
      cart = await this.prisma.cart.findUnique({ where: { userId } });
    } else if (guestCartId) {
      cart = await this.prisma.cart.findUnique({ where: { guestCartId } });
    }

    if (!cart) return { count: 0 };

    const agg = await this.prisma.cartItem.aggregate({
      where: { cartId: cart.id },
      _sum: { quantity: true },
    });

    return { count: agg._sum.quantity ?? 0 };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MERGE GUEST CART → USER CART  (called right after login)
  //
  // Strategy: for each guest item —
  //   • If product already in user cart → take the HIGHER quantity
  //   • If product not in user cart → move it over
  // After merge → delete guest cart
  // ─────────────────────────────────────────────────────────────────────────
  async mergeGuestCart(userId: string, data: MergeCartInput) {
    const { guestCartId } = data;

    // Load guest cart
    const guestCart = await this.prisma.cart.findUnique({
      where: { guestCartId },
      include: {
        items: {
          include: {
            product: { select: { stock: true, status: true } },
          },
        },
      },
    });

    if (!guestCart || guestCart.items.length === 0) {
      AppLogger.info("Cart merge: Nothing to merge for guestCartId", { guestCartId, userId });
      // Nothing to merge — just return user's current cart
      return this.getCart(userId);
    }

    AppLogger.info("Cart merge: Starting merge process", {
      guestCartId,
      userId,
      guestItemCount: guestCart.items.length
    });

    // Ensure user cart exists
    let userCart = await this.prisma.cart.findUnique({ where: { userId } });
    if (!userCart) {
      userCart = await this.prisma.cart.create({ data: { userId } });
    }

    // Merge items inside a transaction
    await this.prisma.$transaction(async (tx) => {
      for (const guestItem of guestCart.items) {
        AppLogger.info("Cart merge: Processing item", { productId: guestItem.productId, quantity: guestItem.quantity });
        // Skip inactive products
        if (guestItem.product.status !== "active") continue;

        const maxQty = Math.min(guestItem.quantity, guestItem.product.stock);
        if (maxQty < 1) continue;

        const existingUserItem = await tx.cartItem.findUnique({
          where: {
            cartId_productId: {
              cartId: userCart!.id,
              productId: guestItem.productId,
            },
          },
        });

        if (existingUserItem) {
          // Take the higher quantity (capped at stock)
          const mergedQty = Math.min(
            Math.max(existingUserItem.quantity, guestItem.quantity),
            guestItem.product.stock,
          );
          await tx.cartItem.update({
            where: { id: existingUserItem.id },
            data: { quantity: mergedQty },
          });
        } else {
          await tx.cartItem.create({
            data: {
              cartId: userCart!.id,
              productId: guestItem.productId,
              quantity: maxQty,
            },
          });
        }
      }

      // Delete guest cart entirely after merge
      await tx.cartItem.deleteMany({ where: { cartId: guestCart.id } });
      await tx.cart.delete({ where: { id: guestCart.id } });
    });

    AppLogger.info("Guest cart merged into user cart", {
      userId,
      guestCartId,
      itemCount: guestCart.items.length,
    });

    // Return fresh user cart
    return this.getCart(userId);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PRIVATE: Build cart response with computed totals
  // ─────────────────────────────────────────────────────────────────────────
  private buildCartResponse(cart: any) {
    const items = cart.items.map((item: any) => {
      const unitPrice = item.product.discountPrice ?? item.product.price;
      const subtotal = parseFloat((unitPrice * item.quantity).toFixed(2));
      const savings = item.product.discountPrice
        ? parseFloat(
          (
            (item.product.price - item.product.discountPrice) *
            item.quantity
          ).toFixed(2),
        )
        : 0;

      return {
        id: item.id,
        productId: item.productId,
        quantity: item.quantity,
        product: item.product,
        unitPrice,
        subtotal,
        savings,
      };
    });

    const totalItems = items.reduce((s: number, i: any) => s + i.quantity, 0);
    const subtotal = parseFloat(
      items.reduce((s: number, i: any) => s + i.subtotal, 0).toFixed(2),
    );
    const totalSavings = parseFloat(
      items.reduce((s: number, i: any) => s + i.savings, 0).toFixed(2),
    );

    return {
      cartId: cart.id,
      guestCartId: cart.guestCartId ?? null,
      items,
      summary: {
        totalItems,
        subtotal,
        totalSavings,
      },
    };
  }
}
