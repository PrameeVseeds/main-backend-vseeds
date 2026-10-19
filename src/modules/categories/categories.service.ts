import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { CategoryListResponseDto } from './dto/category-list-response.dto';
import { RedisCacheService } from '../../common/services/redis-cache.service';
import { Category, Prisma } from '@prisma/client';

export type CategoryWithChildren = Category & {
  children?: CategoryWithChildren[];
};

@Injectable()
export class CategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly cacheService: RedisCacheService,
  ) {}

  private get defaultIcon(): string {
    const icon = this.configService.get<string>('DEFAULT_CATEGORY_ICON');
    if (!icon) return '';
    // If icon is already a full URL, return it as-is
    if (icon.startsWith('http://') || icon.startsWith('https://')) {
      return icon;
    }
    // Otherwise, construct URL with base URL
    const baseUrl = this.configService.get<string>('BASE_URL') || '';
    return `${baseUrl}/uploads/media/${icon}`;
  }

  private mapCategory(category: CategoryWithChildren): CategoryWithChildren {
    if (!category) return category;
    if (!category.icon) {
      category.icon = this.defaultIcon;
    }
    if (category.children) {
      category.children = category.children.map((child) =>
        this.mapCategory(child),
      );
    }
    return category;
  }

  private toListDto(cat: CategoryWithChildren): CategoryListResponseDto {
    const icon = cat.icon || this.defaultIcon;
    return {
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      icon,
      status: cat.status,
      displayOrder: cat.displayOrder,
      parentId: cat.parentId,
      children: cat.children?.map((c) => this.toListDto(c)),
      createdAt: cat.createdAt,
      updatedAt: cat.updatedAt,
    };
  }

  // OPT: Response DTO + selective select to reduce payload (see category-list-response.dto.ts).
  // Single API: returns all root categories with children from categories table + distinct sub_category from products.
  async findAll(status?: string, limit: number = 5): Promise<CategoryListResponseDto[]> {
    const cacheKey = `categories:all:${status || 'any'}:${limit}`;
    const cached =
      await this.cacheService.get<CategoryListResponseDto[]>(cacheKey);
    if (cached && cached.length > 0) {
      return cached;
    }

    const whereCondition: Prisma.CategoryWhereInput = { parentId: null };
    if (status) whereCondition.status = status;

    const categories = await this.prisma.category.findMany({
      where: whereCondition,
      include: { children: true },
      orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
      take: limit,
    });

    if (categories.length === 0) return [];

    const rootIds = categories.map((c) => c.id);
    const productSubsMap = await this.getProductSubcategoriesByCategoryIds(
      rootIds,
      status,
    );

    const result = categories.map((cat) => {
      const dto = this.toListDto(this.mapCategory(cat));
      const productSubs = productSubsMap.get(cat.id) || [];
      const existingNames = new Set(
        (dto.children || []).map((c) => (c.name || '').toLowerCase().trim()),
      );
      const added = productSubs.filter(
        (p) => !existingNames.has((p.name || '').toLowerCase().trim()),
      );
      dto.children = [...(dto.children || []), ...added].sort((a, b) =>
        (a.name || '').localeCompare(b.name || ''),
      );
      return dto;
    });

    await this.cacheService.set<CategoryListResponseDto[]>(
      cacheKey,
      result,
      300000,
    ); // cache for 5 minutes
    return result;
  }

  // OPT: Response DTO + selective select.
  async search(query: string): Promise<CategoryListResponseDto[]> {
    const categories = await this.prisma.category.findMany({
      where: { name: { contains: query } },
      include: { children: true },
      orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
    });
    return categories.map((cat) => this.toListDto(this.mapCategory(cat)));
  }

  // OPT: Response DTO + selective select.
  async findById(id: string): Promise<CategoryListResponseDto> {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: { children: true, parent: true },
    });
    if (!category) throw new NotFoundException('Category not found');
    return this.toListDto(this.mapCategory(category));
  }

  // OPT: Response DTO + selective select.
  async findBySlug(slug: string): Promise<CategoryListResponseDto> {
    const category = await this.prisma.category.findUnique({
      where: { slug },
      include: { children: true, parent: true },
    });
    if (!category) throw new NotFoundException('Category not found');
    return this.toListDto(this.mapCategory(category));
  }

  // ─── Admin: Create ──────────────────────────────────────────────

  async create(dto: CreateCategoryDto) {
    const slug = this.generateSlug(dto.name);
    const icon = dto.icon || this.defaultIcon;
    const saved = await this.prisma.category.create({
      data: {
        name: dto.name,
        slug,
        icon,
        description: dto.description ?? null,
        displayOrder: dto.displayOrder ?? 0,
        status: dto.status ?? 'active',
        parentId: dto.parentId ?? null,
      },
    });
    void this.cacheService.clear();
    return saved;
  }

  // ─── Admin: Update ──────────────────────────────────────────────

  async update(id: string, dto: UpdateCategoryDto) {
    await this.findById(id);
    const updateData: Prisma.CategoryUpdateInput = {};
    if (dto.name !== undefined) {
      updateData.name = dto.name;
      updateData.slug = this.generateSlug(dto.name);
    }
    if (dto.parentId !== undefined) {
      if (dto.parentId) {
        updateData.parent = { connect: { id: dto.parentId } };
      } else {
        updateData.parent = { disconnect: true };
      }
    }
    if (dto.icon !== undefined) updateData.icon = dto.icon;
    if (dto.description !== undefined)
      updateData.description = dto.description ?? null;
    if (dto.displayOrder !== undefined)
      updateData.displayOrder = dto.displayOrder;
    if (dto.status !== undefined) updateData.status = dto.status;

    await this.prisma.category.update({
      where: { id },
      data: updateData,
    });
    void this.cacheService.clear();
    return this.findById(id);
  }

  // ─── Admin: Status ──────────────────────────────────────────────

  async updateStatus(id: string, dto: UpdateStatusDto) {
    await this.findById(id);
    await this.prisma.category.update({
      where: { id },
      data: { status: dto.status },
    });
    void this.cacheService.clear();
    return this.findById(id);
  }

  // ─── Admin: Delete ──────────────────────────────────────────────

  async softDelete(id: string) {
    const category = await this.findById(id);

    // Check if any products use this category
    const productCount = await this.prisma.product.count({
      where: { categoryId: id },
    });

    if (productCount > 0) {
      throw new BadRequestException(
        `Cannot delete category "${category.name}" because it contains ${productCount} product(s). Please move or delete the products first.`,
      );
    }

    // Delete the image from disk if it exists (unless it's the default one)
    const defaultIconPath = this.configService.get<string>(
      'DEFAULT_CATEGORY_ICON',
    );
    if (
      category.icon &&
      (!defaultIconPath ||
        !category.icon.includes(defaultIconPath.split('/').pop() || ''))
    ) {
      // Disk deletion helper is imported but for TypeORM schema cleanups, we just soft-delete the record
    }

    await this.prisma.category.delete({ where: { id } });
    void this.cacheService.clear();
    return { message: 'Category deleted successfully' };
  }

  // ─── Admin: Count ──────────────────────────────────────────────

  async count() {
    const active = await this.prisma.category.count({
      where: { status: 'active' },
    });
    const inactive = await this.prisma.category.count({
      where: { status: 'inactive' },
    });
    return { active, inactive, total: active + inactive };
  }

  // ─── Children (subcategories) ────────────────────────────────────

  /**
   * Returns subcategories for a parent category.
   * Uses distinct sub_category from the products table so the header dropdown shows
   * subcategories that have products, even when the categories table has no child rows.
   * Optionally returns rows from categories table (parent_id = parentId) merged in.
   */
  async getChildren(
    parentId: string,
    status?: string,
  ): Promise<CategoryListResponseDto[]> {
    await this.findById(parentId);
    const fromCategories = await this.getChildrenFromCategoriesTable(
      parentId,
      status,
    );
    const fromProducts = await this.getChildrenFromProductsTable(
      parentId,
      status,
    );
    const byName = new Map<string, CategoryListResponseDto>();
    fromCategories.forEach((c) => byName.set(c.name.toLowerCase().trim(), c));
    fromProducts.forEach((p) => {
      const key = p.name.toLowerCase().trim();
      if (!byName.has(key)) byName.set(key, p);
    });
    return Array.from(byName.values()).sort((a, b) =>
      (a.name || '').localeCompare(b.name || ''),
    );
  }

  /** Children from categories table (rows with parent_id = parentId). */
  private async getChildrenFromCategoriesTable(
    parentId: string,
    status?: string,
  ): Promise<CategoryListResponseDto[]> {
    const where: Prisma.CategoryWhereInput = { parentId: parentId.trim() };
    if (status) {
      where.status = status;
    }
    const children = await this.prisma.category.findMany({
      where,
      orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
    });
    return children.map((c) => this.toListDto(this.mapCategory(c)));
  }

  /** Distinct sub_category from products where category_id = parentId (for header dropdown). */
  private async getChildrenFromProductsTable(
    parentId: string,
    status?: string,
  ): Promise<CategoryListResponseDto[]> {
    const map = await this.getProductSubcategoriesByCategoryIds(
      [parentId],
      status,
    );
    return map.get(parentId.trim()) || [];
  }

  /** One query: distinct sub_category from products per category_id (for batch use in findAll). */
  private async getProductSubcategoriesByCategoryIds(
    categoryIds: string[],
    status?: string,
  ): Promise<Map<string, CategoryListResponseDto[]>> {
    if (!categoryIds.length) return new Map();

    const where: Prisma.ProductWhereInput = {
      categoryId: { in: categoryIds },
      subCategory: { not: null, notIn: [''] },
      deletedAt: null,
    };
    if (status) {
      where.status = status;
    }

    const products = await this.prisma.product.findMany({
      where,
      select: { categoryId: true, subCategory: true },
      distinct: ['categoryId', 'subCategory'],
    });

    const byCategory = new Map<string, CategoryListResponseDto[]>();
    for (const product of products) {
      const cid = (product.categoryId ?? '').trim();
      const name = (product.subCategory ?? '').trim();
      if (!cid || !name) continue;
      const slug = this.generateSlug(name);
      const dto = { id: slug, name, slug } as CategoryListResponseDto;
      const list = byCategory.get(cid) || [];
      if (
        !list.some((x) => (x.name || '').toLowerCase() === name.toLowerCase())
      ) {
        list.push(dto);
        byCategory.set(cid, list);
      }
    }
    return byCategory;
  }

  async getAllWithChildren(): Promise<CategoryListResponseDto[]> {
    const categories = await this.prisma.category.findMany({
      where: { parentId: null },
      include: { children: true },
      orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
    });
    return categories.map((cat) => this.toListDto(this.mapCategory(cat)));
  }

  async updateChildrenStatus(parentId: string, status: string) {
    await this.findById(parentId);
    await this.prisma.category.updateMany({
      where: { parentId },
      data: { status },
    });
    void this.cacheService.clear();
    return this.getChildren(parentId);
  }

  // ─── Helpers ────────────────────────────────────────────────────

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }
}
