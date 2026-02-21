import { BaseModule } from "@/core/BaseModule";
import { AddressService } from "./address.service";
import { AddressController } from "./address.controller";
import { AddressRoutes } from "./address.routes";

export class AddressModule extends BaseModule {
    public readonly name = "AddressModule";
    public readonly version = "1.0.0";
    public readonly dependencies = ["AuthModule"];

    private addressService!: AddressService;
    private addressController!: AddressController;
    private addressRoutes!: AddressRoutes;

    protected async setupServices(): Promise<void> {
        this.addressService = new AddressService(this.context.prisma);
    }

    protected async setupRoutes(): Promise<void> {
        this.addressController = new AddressController(this.addressService);
        this.addressRoutes = new AddressRoutes(this.addressController);

        this.router.use("/api/addresses", this.addressRoutes.getRouter());
    }
}
