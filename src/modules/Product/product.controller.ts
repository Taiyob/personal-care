import { Request, Response } from "express";
import { BaseController } from "@/core/BaseController";
import { ProductService } from "./product.service";
import { HTTPStatusCode } from "@/types/HTTPStatusCode";

export class ProductController extends BaseController {
  constructor(private productService: ProductService) {
    super();
  }

  // POST /api/products  (admin)
  public createProduct = async (req: Request, res: Response) => {
    const body = req.validatedBody || req.body;
    this.logAction("createProduct", req, { name: body.name });

    const product = await this.productService.createProduct(body);

    return this.sendCreatedResponse(
      res,
      product,
      "Product created successfully",
    );
  };

  // PUT /api/products/:id  (admin)
  public updateProduct = async (req: Request, res: Response) => {
    const { id } = req.validatedParams || req.params;
    const body = req.validatedBody || req.body;
    this.logAction("updateProduct", req, { id });

    const product = await this.productService.updateProduct(id, body);

    return this.sendResponse(
      res,
      "Product updated successfully",
      HTTPStatusCode.OK,
      product,
    );
  };

  // DELETE /api/products/:id  (admin)
  public deleteProduct = async (req: Request, res: Response) => {
    const { id } = req.validatedParams || req.params;
    this.logAction("deleteProduct", req, { id });

    const result = await this.productService.deleteProduct(id);

    return this.sendResponse(res, result.message, HTTPStatusCode.OK);
  };

  // PATCH /api/products/:id/stock  (admin)
  public updateStock = async (req: Request, res: Response) => {
    const { id } = req.validatedParams || req.params;
    const { stock } = req.validatedBody || req.body;
    this.logAction("updateStock", req, { id, stock });

    const product = await this.productService.updateStock(id, stock);

    return this.sendResponse(
      res,
      "Stock updated successfully",
      HTTPStatusCode.OK,
      product,
    );
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

    return this.sendResponse(
      res,
      "Featured products retrieved successfully",
      HTTPStatusCode.OK,
      products,
    );
  };

  // GET /api/products/new-arrivals  (public — home page)
  public getNewArrivals = async (req: Request, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 8;
    const products = await this.productService.getNewArrivals(limit);

    return this.sendResponse(
      res,
      "New arrivals retrieved successfully",
      HTTPStatusCode.OK,
      products,
    );
  };

  // GET /api/products/top-rated  (public — home page "Top Rated Product")
  public getTopRatedProducts = async (req: Request, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 8;
    const products = await this.productService.getTopRatedProducts(limit);

    return this.sendResponse(
      res,
      "Top rated products retrieved successfully",
      HTTPStatusCode.OK,
      products,
    );
  };

  // GET /api/products/slug/:slug  (public — single product page)
  public getProductBySlug = async (req: Request, res: Response) => {
    const { slug } = req.validatedParams || req.params;

    const product = await this.productService.getProductBySlug(slug);

    return this.sendResponse(
      res,
      "Product retrieved successfully",
      HTTPStatusCode.OK,
      product,
    );
  };

  // GET /api/products/:id  (admin)
  public getProductById = async (req: Request, res: Response) => {
    const { id } = req.validatedParams || req.params;

    const product = await this.productService.getProductById(id);

    return this.sendResponse(
      res,
      "Product retrieved successfully",
      HTTPStatusCode.OK,
      product,
    );
  };

  // GET /api/products/:id/related  (public — "Shop Your Perfect Skin Match")
  public getRelatedProducts = async (req: Request, res: Response) => {
    const { id } = req.validatedParams || req.params;
    const limit = parseInt(req.query.limit as string) || 6;

    const products = await this.productService.getRelatedProducts(id, limit);

    return this.sendResponse(
      res,
      "Related products retrieved successfully",
      HTTPStatusCode.OK,
      products,
    );
  };
}
