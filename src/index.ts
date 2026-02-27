import { IgnitorApp } from "./core/IgnitorApp";
import { AppLogger } from "./core/logging/logger";
import { config } from "./core/config";
import { AuthModule } from "./modules/Auth/AuthModule";
import { CategoryModule } from "./modules/Category/CategoryModule";
import { ProductModule } from "./modules/Product/ProductModule";
import { ReviewModule } from "./modules/Review/ReviewModule";
import { CartModule } from "./modules/Cart/CartModule";
import { AddressModule } from "./modules/Address/AddressModule";
import { OrderModule } from "./modules/Order/OrderModule";
import { WishlistModule } from "./modules/Wishlist/WishlistModule";
import { ProfileModule } from "./modules/Profile/ProfileModule";
import { ReturnModule } from "./modules/Return/ReturnModule";
import { PaymentModule } from "./modules/Payment/PaymentModule";

async function bootstrap() {
  try {
    AppLogger.info("🗹 Starting application bootstrap");

    const app = new IgnitorApp();

    AppLogger.info("⚙ Registering modules...");

    // Order matters: dependencies must be registered before dependents
    app.registerModule(new AuthModule());
    app.registerModule(new CategoryModule());
    app.registerModule(new ProductModule());
    app.registerModule(new ReviewModule());
    app.registerModule(new CartModule());
    app.registerModule(new AddressModule());
    app.registerModule(new OrderModule());
    app.registerModule(new WishlistModule());
    app.registerModule(new ProfileModule());
    app.registerModule(new ReturnModule());
    app.registerModule(new PaymentModule());

    AppLogger.info("✔ All modules registered successfully");

    await app.spark(config.server.port);

    process.on("SIGTERM", () => shutdown(app));
    process.on("SIGINT", () => shutdown(app));

    AppLogger.info("✷ Ignitor sparked successfully");
  } catch (error) {
    AppLogger.error("✗ Bootstrap failed:", {
      error: error instanceof Error ? error : new Error(String(error)),
      stack: error instanceof Error ? error.stack : undefined,
    });
    process.exit(1);
  }
}

async function shutdown(app: IgnitorApp) {
  AppLogger.info("Received shutdown signal, shutting down gracefully...");
  try {
    await app.shutdown();
    AppLogger.info("Graceful shutdown completed");
    process.exit(0);
  } catch (error) {
    AppLogger.error("Error during graceful shutdown:", {
      error: error instanceof Error ? error : new Error(String(error)),
    });
    process.exit(1);
  }
}

bootstrap().catch((err) => {
  AppLogger.error("❌ Unhandled bootstrap error:", err);
  process.exit(1);
});
