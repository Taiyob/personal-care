import { Request, Response } from "express";
import { BaseController } from "@/core/BaseController";
import { CategoryService } from "./category.service";
import { HTTPStatusCode } from "@/types/HTTPStatusCode";

export class CategoryController extends BaseController {
  constructor(private categoryService: CategoryService) {
    super();
  }

  // POST /api/categories  (admin)
  public createCategory = async (req: Request, res: Response) => {
    const body = req.validatedBody || req.body;
    this.logAction("createCategory", req, { name: body.name });

    const category = await this.categoryService.createCategory(body);

    return this.sendCreatedResponse(
      res,
      category,
      "Category created successfully",
    );
  };

  // PUT /api/categories/:id  (admin)
  public updateCategory = async (req: Request, res: Response) => {
    const { id } = req.validatedParams || req.params;
    const body = req.validatedBody || req.body;
    this.logAction("updateCategory", req, { id });

    const category = await this.categoryService.updateCategory(id, body);

    return this.sendResponse(
      res,
      "Category updated successfully",
      HTTPStatusCode.OK,
      category,
    );
  };

  // DELETE /api/categories/:id  (admin)
  public deleteCategory = async (req: Request, res: Response) => {
    const { id } = req.validatedParams || req.params;
    this.logAction("deleteCategory", req, { id });

    const result = await this.categoryService.deleteCategory(id);

    return this.sendResponse(res, result.message, HTTPStatusCode.OK);
  };

  // GET /api/categories  (public)
  public getCategories = async (req: Request, res: Response) => {
    const query = req.validatedQuery || req.query;
    const pagination = this.extractPaginationParams(req);

    const result = await this.categoryService.getCategories({
      page: pagination.page,
      limit: pagination.limit,
      parentId: query.parentId,
      isActive: query.isActive,
      search: query.search,
    });

    return this.sendPaginatedResponse(
      res,
      this.calculatePagination(result.page, result.limit, result.total),
      "Categories retrieved successfully",
      result.data,
    );
  };

  // GET /api/categories/tree  (public — home page nav)
  public getCategoryTree = async (req: Request, res: Response) => {
    const tree = await this.categoryService.getCategoryTree();

    return this.sendResponse(
      res,
      "Category tree retrieved successfully",
      HTTPStatusCode.OK,
      tree,
    );
  };

  // GET /api/categories/slug/:slug  (public)
  public getCategoryBySlug = async (req: Request, res: Response) => {
    const { slug } = req.validatedParams || req.params;

    const category = await this.categoryService.getCategoryBySlug(slug);

    return this.sendResponse(
      res,
      "Category retrieved successfully",
      HTTPStatusCode.OK,
      category,
    );
  };

  // GET /api/categories/:id  (admin)
  public getCategoryById = async (req: Request, res: Response) => {
    const { id } = req.validatedParams || req.params;

    const category = await this.categoryService.getCategoryById(id);

    return this.sendResponse(
      res,
      "Category retrieved successfully",
      HTTPStatusCode.OK,
      category,
    );
  };

  // PATCH /api/categories/:id/toggle-active  (admin)
  public toggleActive = async (req: Request, res: Response) => {
    const { id } = req.validatedParams || req.params;
    this.logAction("toggleCategoryActive", req, { id });

    const category = await this.categoryService.toggleActive(id);

    return this.sendResponse(
      res,
      `Category ${category.isActive ? "activated" : "deactivated"} successfully`,
      HTTPStatusCode.OK,
      category,
    );
  };
}
