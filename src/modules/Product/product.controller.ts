import { Request, Response } from "express";
import { BaseController } from "@/core/BaseController";
import { ProductService } from "./product.service";
import { HTTPStatusCode } from "@/types/HTTPStatusCode";
import { MinioService } from "@/services/MinioService";
import { ProductValidation } from "./product.validation";

export class ProductController extends BaseController {
  constructor(private productService: ProductService) {
    super();
  }

  // POST /api/products  (admin)
  // multipart/form-data: text fields + files (featuredImage, images[])
  public createProduct = async (req: Request, res: Response) => {
    // Parse numeric/boolean fields from form-data strings
    const body = this.parseProductBody(req.body);
    this.logAction("createProduct", req, { name: body.name });

    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;

    // Validate body with Zod (featuredImage/images optional — will be set below)
    const parsed = ProductValidation.create.parse(body);

    // Upload featuredImage to MinIO if provided as file
    if (files?.featuredImage?.[0]) {
      parsed.featuredImage = await MinioService.uploadFile(
        "products",
        files.featuredImage[0],
      );
    }

    // Upload gallery images to MinIO
    if (files?.images?.length) {
      parsed.images = await Promise.all(
        files.images.map(async (file) => ({
          url: await MinioService.uploadFile("products", file),
          alt: body.name ?? "product image",
        })),
      );
    }

    const product = await this.productService.createProduct(parsed);

    return this.sendCreatedResponse(res, product, "Product created successfully");
  };

  // PUT /api/products/:id  (admin)
  public updateProduct = async (req: Request, res: Response) => {
    const { id } = req.params;
    const body = this.parseProductBody(req.body);
    this.logAction("updateProduct", req, { id });

    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;

    // Validate body
    const parsed = ProductValidation.update.parse(body);

    // Get old product to know which images to delete later
    const oldProduct = await this.productService.getProductById(id);

    // Upload new featuredImage and delete old one
    if (files?.featuredImage?.[0]) {
      if (oldProduct.featuredImage) {
        await MinioService.deleteFile(oldProduct.featuredImage);
      }
      parsed.featuredImage = await MinioService.uploadFile(
        "products",
        files.featuredImage[0],
      );
    }

    // Upload new gallery images and delete old ones
    if (files?.images?.length) {
      if (oldProduct.images && Array.isArray(oldProduct.images)) {
        const oldUrls = (oldProduct.images as any[]).map((img: any) => img.url);
        await MinioService.deleteFiles(oldUrls);
      }
      parsed.images = await Promise.all(
        files.images.map(async (file) => ({
          url: await MinioService.uploadFile("products", file),
          alt: body.name ?? oldProduct.name,
        })),
      );
    }

    const product = await this.productService.updateProduct(id, parsed);

    return this.sendResponse(res, "Product updated successfully", HTTPStatusCode.OK, product);
  };

  // DELETE /api/products/:id  (admin)
  public deleteProduct = async (req: Request, res: Response) => {
    const { id } = req.validatedParams || req.params;
    this.logAction("deleteProduct", req, { id });

    // Fetch before delete to get image URLs
    const existing = await this.productService.getProductById(id);

    const result = await this.productService.deleteProduct(id);

    // If product was truly deleted (not just deactivated), clean up MinIO
    if (result.message.includes("deleted successfully")) {
      const urlsToDelete: string[] = [];
      if (existing.featuredImage) urlsToDelete.push(existing.featuredImage);
      if (existing.images && Array.isArray(existing.images)) {
        (existing.images as any[]).forEach((img: any) => {
          if (img?.url) urlsToDelete.push(img.url);
        });
      }
      await MinioService.deleteFiles(urlsToDelete);
    }

    return this.sendResponse(res, result.message, HTTPStatusCode.OK);
  };

  // PATCH /api/products/:id/stock  (admin)
  public updateStock = async (req: Request, res: Response) => {
    const { id } = req.validatedParams || req.params;
    const { stock } = req.validatedBody || req.body;
    this.logAction("updateStock", req, { id, stock });

    const product = await this.productService.updateStock(id, stock);

    return this.sendResponse(res, "Stock updated successfully", HTTPStatusCode.OK, product);
  };

  // GET /api/products  (public — shop page)
  public getProducts = async (req: Request, res: Response) => {
    const query = req.validatedQuery || req.query;

    const result = await this.productService.getProducts(query as any);

    return this.sendPaginatedResponse(
      res,
      this.calculatePagination(result.page, result.limit, result.total),
      "Products retrieved successfully",
      result.data,
    );
  };

  // GET /api/products/featured  (public — home page)
  public getFeaturedProducts = async (req: Request, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 8;
    const products = await this.productService.getFeaturedProducts(limit);

    return this.sendResponse(res, "Featured products retrieved successfully", HTTPStatusCode.OK, products);
  };

  // GET /api/products/new-arrivals  (public — home page)
  public getNewArrivals = async (req: Request, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 8;
    const products = await this.productService.getNewArrivals(limit);

    return this.sendResponse(res, "New arrivals retrieved successfully", HTTPStatusCode.OK, products);
  };

  // GET /api/products/top-rated  (public — home page "Top Rated Product")
  public getTopRatedProducts = async (req: Request, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 8;
    const products = await this.productService.getTopRatedProducts(limit);

    return this.sendResponse(res, "Top rated products retrieved successfully", HTTPStatusCode.OK, products);
  };

  // GET /api/products/slug/:slug  (public — single product page)
  public getProductBySlug = async (req: Request, res: Response) => {
    const { slug } = req.validatedParams || req.params;

    const product = await this.productService.getProductBySlug(slug);

    return this.sendResponse(res, "Product retrieved successfully", HTTPStatusCode.OK, product);
  };

  // GET /api/products/:id  (admin)
  public getProductById = async (req: Request, res: Response) => {
    const { id } = req.validatedParams || req.params;

    const product = await this.productService.getProductById(id);

    return this.sendResponse(res, "Product retrieved successfully", HTTPStatusCode.OK, product);
  };

  // GET /api/products/:id/related  (public — "Shop Your Perfect Skin Match")
  public getRelatedProducts = async (req: Request, res: Response) => {
    const { id } = req.validatedParams || req.params;
    const limit = parseInt(req.query.limit as string) || 6;

    const products = await this.productService.getRelatedProducts(id, limit);

    return this.sendResponse(res, "Related products retrieved successfully", HTTPStatusCode.OK, products);
  };

  // ─── Private helper: parse form-data text fields to correct types ──────────
  private parseProductBody(body: any): any {
    const parsed: any = { ...body };

    // Convert numeric strings
    if (parsed.price !== undefined) parsed.price = Number(parsed.price);
    if (parsed.discountPrice !== undefined)
      parsed.discountPrice =
        parsed.discountPrice !== "" && parsed.discountPrice !== null
          ? Number(parsed.discountPrice)
          : null;
    if (parsed.stock !== undefined) parsed.stock = Number(parsed.stock);

    // Convert boolean strings
    if (parsed.isFeatured !== undefined)
      parsed.isFeatured = parsed.isFeatured === "true" || parsed.isFeatured === true;
    if (parsed.isNewArrival !== undefined)
      parsed.isNewArrival = parsed.isNewArrival === "true" || parsed.isNewArrival === true;

    // Parse images JSON string if sent as text (e.g., from form-data)
    if (typeof parsed.images === "string") {
      try {
        parsed.images = JSON.parse(parsed.images);
      } catch {
        delete parsed.images;
      }
    }

    return parsed;
  }
}
