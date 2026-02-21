import { BaseService } from "@/core/BaseService";
import { AppLogger } from "@/core/logging/logger";
import {
  ConflictError,
  NotFoundError,
  BadRequestError,
} from "@/core/errors/AppError";
import { PrismaClient, Category } from "@/generated/prisma/client";
import {
  CategoryListQuery,
  CreateCategoryInput,
  UpdateCategoryInput,
} from "./category.validation";

export class CategoryService extends BaseService<Category> {
  constructor(prisma: PrismaClient) {
    super(prisma, "Category", {
      enableSoftDelete: false,
      enableAuditFields: true,
    });
  }

  protected getModel() {
    return this.prisma.category;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CREATE CATEGORY  (admin)
  // ─────────────────────────────────────────────────────────────────────────
  async createCategory(data: CreateCategoryInput): Promise<Category> {
    // Auto-generate slug if not provided
    const slug = data.slug ?? (await this.generateUniqueSlug(data.name));

    // Check name uniqueness
    const existing = await this.prisma.category.findUnique({
      where: { name: data.name },
    });
    if (existing) {
      throw new ConflictError(
        `Category with name "${data.name}" already exists`,
      );
    }

    // Validate parentId exists
    if (data.parentId) {
      const parent = await this.prisma.category.findUnique({
        where: { id: data.parentId },
      });
      if (!parent) throw new NotFoundError("Parent category not found");
    }

    const category = await this.create({
      name: data.name,
      slug,
      description: data.description,
      imageUrl: data.imageUrl,
      parentId: data.parentId ?? null,
      isActive: data.isActive ?? true,
    });

    AppLogger.info("Category created", {
      id: category.id,
      name: category.name,
    });
    return category;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // UPDATE CATEGORY  (admin)
  // ─────────────────────────────────────────────────────────────────────────
  async updateCategory(
    id: string,
    data: UpdateCategoryInput,
  ): Promise<Category> {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) throw new NotFoundError("Category not found");

    // Re-generate slug if name changed and slug not explicitly provided
    let slug = data.slug;
    if (data.name && data.name !== category.name && !slug) {
      slug = await this.generateUniqueSlug(data.name, id);
    }

    // Check new name uniqueness
    if (data.name && data.name !== category.name) {
      const nameConflict = await this.prisma.category.findUnique({
        where: { name: data.name },
      });
      if (nameConflict)
        throw new ConflictError(`Category "${data.name}" already exists`);
    }

    // Prevent setting itself as parent
    if (data.parentId === id) {
      throw new BadRequestError("A category cannot be its own parent");
    }

    const updated = await this.updateById(id, {
      ...data,
      ...(slug ? { slug } : {}),
    });

    AppLogger.info("Category updated", { id });
    return updated;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DELETE CATEGORY  (admin)
  // ─────────────────────────────────────────────────────────────────────────
  async deleteCategory(id: string): Promise<{ message: string }> {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: { children: true, products: { take: 1 } },
    });

    if (!category) throw new NotFoundError("Category not found");

    if (category.children.length > 0) {
      throw new BadRequestError(
        "Cannot delete a category that has subcategories. Remove subcategories first.",
      );
    }

    if (category.products.length > 0) {
      throw new BadRequestError(
        "Cannot delete a category that has products. Reassign or remove products first.",
      );
    }

    await this.deleteById(id);

    AppLogger.info("Category deleted", { id, name: category.name });
    return { message: "Category deleted successfully" };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GET ALL CATEGORIES  (public)
  // Supports: pagination, search, parentId filter, isActive filter
  // ─────────────────────────────────────────────────────────────────────────
  async getCategories(query: CategoryListQuery) {
    const { page = 1, limit = 20, parentId, isActive, search } = query;

    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    if (parentId !== undefined) {
      where.parentId = parentId;
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    return this.findMany(
      where,
      { page, limit, offset: (page - 1) * limit },
      { name: "asc" },
      {
        children: {
          where: { isActive: true },
          select: { id: true, name: true, slug: true, imageUrl: true },
        },
        _count: { select: { products: true } },
      },
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GET CATEGORY BY SLUG  (public)
  // ─────────────────────────────────────────────────────────────────────────
  async getCategoryBySlug(slug: string) {
    const category = await this.prisma.category.findUnique({
      where: { slug },
      include: {
        parent: { select: { id: true, name: true, slug: true } },
        children: {
          where: { isActive: true },
          select: { id: true, name: true, slug: true, imageUrl: true },
        },
        _count: { select: { products: true } },
      },
    });

    if (!category) throw new NotFoundError("Category not found");
    return category;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GET CATEGORY BY ID  (admin)
  // ─────────────────────────────────────────────────────────────────────────
  async getCategoryById(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: {
        parent: { select: { id: true, name: true, slug: true } },
        children: {
          select: { id: true, name: true, slug: true, isActive: true },
        },
        _count: { select: { products: true } },
      },
    });

    if (!category) throw new NotFoundError("Category not found");
    return category;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GET TOP-LEVEL CATEGORIES WITH CHILDREN  (public — for home page nav)
  // ─────────────────────────────────────────────────────────────────────────
  async getCategoryTree() {
    const roots = await this.prisma.category.findMany({
      where: { parentId: null, isActive: true },
      orderBy: { name: "asc" },
      include: {
        children: {
          where: { isActive: true },
          orderBy: { name: "asc" },
          select: { id: true, name: true, slug: true, imageUrl: true },
        },
        _count: { select: { products: true } },
      },
    });

    return roots;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TOGGLE ACTIVE STATUS  (admin)
  // ─────────────────────────────────────────────────────────────────────────
  async toggleActive(id: string): Promise<Category> {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) throw new NotFoundError("Category not found");

    const updated = await this.updateById(id, { isActive: !category.isActive });

    AppLogger.info(
      `Category ${updated.isActive ? "activated" : "deactivated"}`,
      { id },
    );
    return updated;
  }
}
