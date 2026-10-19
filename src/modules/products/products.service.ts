import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductQueryDto } from './dto/product-query.dto';
import { UpdateProductStatusDto } from './dto/update-product-status.dto';
import { ProductAttributeDto } from './dto/create-product.dto';
import { ImagesService } from '../images/images.service';
import { RedisCacheService } from '../../common/services/redis-cache.service';
import { Prisma } from '@prisma/client';

type ProductWithRelations = any;

const productDetailSelect = {
  id: true,
  name: true,
  slug: true,
  sku: true,
  description: true,
  shortDescription: true,
  minPurchaseValue: true,
  specifications: true,
  tags: true,
  datasheetUrl: true,
  model3dUrl: true,
  productLink: true,
  subCategory: true,
  subCategoryId: true,
  storeId: true,
  manufacturer: true,
  manufacturerProductNumber: true,
  quantityInHand: true,
  quantityOrdered: true,
  purchasedPrice: true,
  expectedDate: true,
  status: true,
  isFeatured: true,
  createdAt: true,
  updatedAt: true,
  categoryId: true,
  category: {
    select: { id: true, name: true, slug: true },
  },
  priceTiers: {
    select: { id: true, minQuantity: true, price: true },
  },
  productMedia: {
    where: { media: { deletedAt: null } },
    select: {
      isThumbnail: true,
      displayOrder: true,
      media: {
        select: { id: true, filename: true, url: true },
      },
    },
  },
  productAttributes: {
    select: {
      id: true,
      attributeId: true,
      value: true,
      isSimilarFilter: true,
      attribute: {
        select: { id: true, name: true },
      },
    },
  },
};

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly imagesService: ImagesService,
    private readonly cacheService: RedisCacheService,
  ) {}

  private async resolveOrCreateCategory(
    categoryId?: string,
    categoryName?: string,
  ): Promise<string | undefined> {
    if (categoryId) return categoryId;
    if (!categoryName?.trim()) return undefined;
    const name = categoryName.trim();
    const existing = await this.prisma.category.findFirst({
      where: { name, parentId: null, deletedAt: null },
    });
    if (existing) return existing.id;
    const created = await this.prisma.category.create({
      data: {
        name,
        slug: this.generateSlug(name),
        status: 'active',
        displayOrder: 0,
      },
    });
    return created.id;
  }

  private async resolveOrCreateSubCategory(
    name: string | null | undefined,
    categoryId: string | null | undefined,
  ): Promise<string | undefined> {
    if (!categoryId || !name?.trim()) return undefined;
    const trimmed = name.trim();
    const existing = await this.prisma.subCategory.findFirst({
      where: { categoryId, name: trimmed },
    });
    if (existing) return existing.id;
    try {
      const created = await this.prisma.subCategory.create({
        data: {
          categoryId,
          name: trimmed,
          slug: this.generateSlug(trimmed),
          status: 'active',
          displayOrder: 0,
        },
      });
      return created.id;
    } catch {
      const retry = await this.prisma.subCategory.findFirst({
        where: { categoryId, name: trimmed },
      });
      return retry?.id;
    }
  }

  // ─── Public: List with search, filter, pagination ───────────────

  async findAll(query: ProductQueryDto) {
    if (query.view === 'admin') {
      return this.findAllAdmin(query);
    }
    return this.findAllCatalog(query);
  }

  // Full response for customer-facing frontends (includes images, description, etc.)
  // Uses LEFT JOINs + GROUP BY for efficient single-query fetch instead of N subqueries.
  private async findAllCatalog(query: ProductQueryDto) {
    const { page = 1, limit = 20, search, status, filter, categoryId, subcategory, manufacturer } = query;

    const cacheKey = `catalog:page=${page}:limit=${limit}:search=${search || ''}:status=${status || ''}:filter=${filter || ''}:categoryId=${categoryId || ''}:subcategory=${subcategory || ''}:manufacturer=${manufacturer || ''}`;
    const cached = await this.cacheService.get<unknown>(cacheKey);
    if (cached) {
      return cached;
    }

    const offset = (page - 1) * limit;
    let sqlConditions = '(p.deleted_at IS NULL OR IFNULL(TO_DAYS(p.deleted_at), 0) = 0)';
    const params: unknown[] = [];

    if (status) {
      sqlConditions += ' AND p.status = ?';
      params.push(status);
    }
    if (categoryId) {
      sqlConditions += ' AND p.category_id = ?';
      params.push(categoryId);
    }
    if (subcategory) {
      const matchedSubCats = await this.prisma.subCategory.findMany({
        where: {
          OR: [{ slug: subcategory }, { name: subcategory }],
        },
        select: { id: true, name: true, slug: true },
      });

      const stringMatches = new Set<string>([subcategory]);
      for (const s of matchedSubCats) {
        if (s.name) stringMatches.add(s.name);
        if (s.slug) stringMatches.add(s.slug);
      }
      const stringValues = Array.from(stringMatches);
      const stringPlaceholders = stringValues.map(() => '?').join(',');

      if (matchedSubCats.length > 0) {
        const idValues = matchedSubCats.map((s) => s.id);
        const idPlaceholders = idValues.map(() => '?').join(',');
        sqlConditions += ` AND (p.sub_category IN (${stringPlaceholders}) OR p.sub_category_id IN (${idPlaceholders}))`;
        params.push(...stringValues, ...idValues);
      } else {
        sqlConditions += ` AND p.sub_category IN (${stringPlaceholders})`;
        params.push(...stringValues);
      }
    }
    if (query.excludeId) {
      sqlConditions += ' AND p.id != ?';
      params.push(query.excludeId);
    }
    if (query.tags) {
      sqlConditions += ' AND CAST(p.tags AS CHAR) LIKE ?';
      params.push(`%${query.tags}%`);
    }
    if (search) {
      sqlConditions +=
        ' AND (p.name LIKE ? OR p.sku LIKE ? OR CAST(p.tags AS CHAR) LIKE ? OR c.name LIKE ?)';
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam, searchParam, searchParam);
    }
    if (manufacturer) {
      sqlConditions += ' AND LOWER(p.manufacturer) = LOWER(?)';
      params.push(manufacturer.trim());
    }

    if (query.productId && query.attributeIds?.trim()) {
      const filterIds = query.attributeIds
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (filterIds.length > 0) {
        const placeholders = filterIds.map(() => '?').join(',');
        const attributeValues: any[] = await this.prisma.$queryRawUnsafe(
          `SELECT attribute_id as attributeId, value FROM product_attributes WHERE product_id = ? AND attribute_id IN (${placeholders})`,
          query.productId,
          ...filterIds,
        );
        if (attributeValues.length > 0) {
          const attrConditions = attributeValues
            .map(() => '(pa.attribute_id = ? AND pa.value = ?)')
            .join(' OR ');
          const attrParams = attributeValues.flatMap((a: any) => [
            a.attributeId,
            a.value,
          ]);
          sqlConditions += ` AND p.id != ? AND EXISTS (SELECT 1 FROM product_attributes pa WHERE pa.product_id = p.id AND (${attrConditions}))`;
          params.push(query.productId, ...attrParams);
        }
      }
    } else if (query.attributes?.trim()) {
      const pairs = query.attributes
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const attrConditions = pairs
        .map(() => '(a.name = ? AND pa.value = ?)')
        .join(' OR ');
      const attrParams: any[] = [];
      for (const pair of pairs) {
        const [key, value] = pair.split(':');
        const attributeName = key?.trim();
        const attrValue = value?.trim();
        if (attributeName && attrValue) {
          attrParams.push(attributeName, attrValue);
        }
      }
      if (attrParams.length > 0) {
        sqlConditions += ` AND EXISTS (SELECT 1 FROM product_attributes pa JOIN attributes a ON a.id = pa.attribute_id WHERE pa.product_id = p.id AND (${attrConditions}))`;
        params.push(...attrParams);
      }
    }

    let orderByClause = 'ORDER BY p.created_at DESC';
    if (filter === 'new') {
      // Show products marked as featured (used for new arrivals)
      // If no featured products exist, show most recent products instead
      const featuredCount = await this.prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(DISTINCT p.id) as count
        FROM products p
        WHERE p.deleted_at IS NULL 
        AND p.is_featured = true
      `;
      
      if (featuredCount[0]?.count === 0n) {
        // No featured products, just show most recent products
        // Don't add the featured filter
      } else {
        // Add the featured filter to show only featured products
        sqlConditions += ' AND p.is_featured = true';
      }
    } else if (filter === 'price_low_to_high') {
      orderByClause =
        'ORDER BY (SELECT MIN(tier.price) FROM product_price_tiers tier WHERE tier.product_id = p.id) ASC';
    } else if (filter === 'price_high_to_low') {
      orderByClause =
        'ORDER BY (SELECT MIN(tier.price) FROM product_price_tiers tier WHERE tier.product_id = p.id) DESC';
    } else if (filter === 'name_a_to_z') {
      orderByClause = 'ORDER BY p.name ASC';
    } else if (filter === 'name_z_to_a') {
      orderByClause = 'ORDER BY p.name DESC';
    }

    const countSql = `
      SELECT COUNT(DISTINCT p.id) AS total
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE ${sqlConditions}
    `;

    const countResult = await this.prisma.$queryRawUnsafe<
      { total: bigint | number }[]
    >(countSql, ...params);
    const total = Number(countResult[0]?.total ?? 0);

    const selectSql = `
      SELECT
        p.id AS id,
        p.name AS name,
        p.sku AS sku,
        p.slug AS slug,
        p.description AS description,
        p.short_description AS shortDescription,
        p.min_purchase_value AS minPurchaseValue,
        CAST(p.specifications AS CHAR) AS specifications,
        CAST(p.tags AS CHAR) AS tags,
        p.store_id AS storeId,
        p.manufacturer AS manufacturer,
        p.manufacturer_product_number AS manufacturerProductNumber,
        p.sub_category AS subCategory,
        p.product_link AS productLink,
        p.status AS status,
        p.is_featured AS isFeatured,
        p.quantity_in_hand AS quantityInHand,
        p.quantity_ordered AS quantityOrdered,
        p.purchased_price AS purchasedPrice,
        p.expected_date AS expectedDate,
        p.datasheet_url AS datasheetUrl,
        IF(IFNULL(TO_DAYS(p.created_at), 0) = 0, NOW(), p.created_at) AS createdAt,
        IF(IFNULL(TO_DAYS(p.updated_at), 0) = 0, NOW(), p.updated_at) AS updatedAt,
        p.category_id AS categoryId,
        c.name AS categoryName,
        c.slug AS categorySlug,
        MAX(CASE WHEN pm.is_thumbnail = 1 THEN m.url ELSE NULL END) AS thumbnailImage,
        GROUP_CONCAT(m.url ORDER BY pm.display_order SEPARATOR ',') AS imageUrls,
        MAX(CASE WHEN pt.min_quantity = 1 THEN pt.price ELSE NULL END) AS price1,
        MAX(CASE WHEN pt.min_quantity = 10 THEN pt.price ELSE NULL END) AS price10,
        MAX(CASE WHEN pt.min_quantity = 100 THEN pt.price ELSE NULL END) AS price100
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      LEFT JOIN product_media pm ON pm.product_id = p.id
      LEFT JOIN media m ON m.id = pm.media_id
      LEFT JOIN product_price_tiers pt ON pt.product_id = p.id
      WHERE ${sqlConditions}
      GROUP BY p.id
      ${orderByClause}
      LIMIT ? OFFSET ?
    `;

    const selectParams: unknown[] = [...params, limit, offset];
    const rows = await this.prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      selectSql,
      ...selectParams,
    );

    const result = {
      products: rows.map((row) => this.mapRawRowToCatalog(row)),
      total,
      totalPages: Math.ceil(total / limit),
      page,
    };
    await this.cacheService.set(cacheKey, result, 300000); // cache 5 minutes
    return result;
  }

  // Lean response for admin table views — uses LEFT JOINs instead of subqueries
  private async findAllAdmin(query: ProductQueryDto) {
    const { page = 1, limit = 20, search, status, filter, categoryId, subcategory, manufacturer } = query;

    const offset = (page - 1) * limit;
    let sqlConditions = '(p.deleted_at IS NULL OR IFNULL(TO_DAYS(p.deleted_at), 0) = 0)';
    const params: unknown[] = [];

    if (status) {
      sqlConditions += ' AND p.status = ?';
      params.push(status);
    }
    if (categoryId) {
      sqlConditions += ' AND p.category_id = ?';
      params.push(categoryId);
    }
    if (subcategory) {
      const matchedSubCats = await this.prisma.subCategory.findMany({
        where: {
          OR: [{ slug: subcategory }, { name: subcategory }],
        },
        select: { id: true, name: true, slug: true },
      });

      const stringMatches = new Set<string>([subcategory]);
      for (const s of matchedSubCats) {
        if (s.name) stringMatches.add(s.name);
        if (s.slug) stringMatches.add(s.slug);
      }
      const stringValues = Array.from(stringMatches);
      const stringPlaceholders = stringValues.map(() => '?').join(',');

      if (matchedSubCats.length > 0) {
        const idValues = matchedSubCats.map((s) => s.id);
        const idPlaceholders = idValues.map(() => '?').join(',');
        sqlConditions += ` AND (p.sub_category IN (${stringPlaceholders}) OR p.sub_category_id IN (${idPlaceholders}))`;
        params.push(...stringValues, ...idValues);
      } else {
        sqlConditions += ` AND p.sub_category IN (${stringPlaceholders})`;
        params.push(...stringValues);
      }
    }
    if (query.excludeId) {
      sqlConditions += ' AND p.id != ?';
      params.push(query.excludeId);
    }
    if (query.tags) {
      sqlConditions += ' AND CAST(p.tags AS CHAR) LIKE ?';
      params.push(`%${query.tags}%`);
    }
    if (search) {
      sqlConditions +=
        ' AND (p.name LIKE ? OR p.sku LIKE ? OR CAST(p.tags AS CHAR) LIKE ? OR c.name LIKE ?)';
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam, searchParam, searchParam);
    }
    if (manufacturer) {
      sqlConditions += ' AND LOWER(p.manufacturer) = LOWER(?)';
      params.push(manufacturer.trim());
    }

    if (query.productId && query.attributeIds?.trim()) {
      const filterIds = query.attributeIds
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (filterIds.length > 0) {
        const placeholders = filterIds.map(() => '?').join(',');
        const attributeValues: any[] = await this.prisma.$queryRawUnsafe(
          `SELECT attribute_id as attributeId, value FROM product_attributes WHERE product_id = ? AND attribute_id IN (${placeholders})`,
          query.productId,
          ...filterIds,
        );
        if (attributeValues.length > 0) {
          const attrConditions = attributeValues
            .map(() => '(pa.attribute_id = ? AND pa.value = ?)')
            .join(' OR ');
          const attrParams = attributeValues.flatMap((a: any) => [
            a.attributeId,
            a.value,
          ]);
          sqlConditions += ` AND p.id != ? AND EXISTS (SELECT 1 FROM product_attributes pa WHERE pa.product_id = p.id AND (${attrConditions}))`;
          params.push(query.productId, ...attrParams);
        }
      }
    } else if (query.attributes?.trim()) {
      const pairs = query.attributes
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const attrConditions = pairs
        .map(() => '(a.name = ? AND pa.value = ?)')
        .join(' OR ');
      const attrParams: any[] = [];
      for (const pair of pairs) {
        const [key, value] = pair.split(':');
        const attributeName = key?.trim();
        const attrValue = value?.trim();
        if (attributeName && attrValue) {
          attrParams.push(attributeName, attrValue);
        }
      }
      if (attrParams.length > 0) {
        sqlConditions += ` AND EXISTS (SELECT 1 FROM product_attributes pa JOIN attributes a ON a.id = pa.attribute_id WHERE pa.product_id = p.id AND (${attrConditions}))`;
        params.push(...attrParams);
      }
    }

    let orderByClause = 'ORDER BY p.created_at DESC';
    if (filter === 'new') {
      // Show products marked as featured (used for new arrivals)
      // If no featured products exist, show most recent products instead
      const featuredCount = await this.prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(DISTINCT p.id) as count
        FROM products p
        WHERE p.deleted_at IS NULL 
        AND p.is_featured = true
      `;
      
      if (featuredCount[0]?.count === 0n) {
        // No featured products, just show most recent products
        // Don't add the featured filter
      } else {
        // Add the featured filter to show only featured products
        sqlConditions += ' AND p.is_featured = true';
      }
    } else if (filter === 'price_low_to_high') {
      orderByClause =
        'ORDER BY (SELECT MIN(tier.price) FROM product_price_tiers tier WHERE tier.product_id = p.id) ASC';
    } else if (filter === 'price_high_to_low') {
      orderByClause =
        'ORDER BY (SELECT MIN(tier.price) FROM product_price_tiers tier WHERE tier.product_id = p.id) DESC';
    } else if (filter === 'name_a_to_z') {
      orderByClause = 'ORDER BY p.name ASC';
    } else if (filter === 'name_z_to_a') {
      orderByClause = 'ORDER BY p.name DESC';
    }

    const countSql = `
      SELECT COUNT(DISTINCT p.id) AS total
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE ${sqlConditions}
    `;

    const countResult = await this.prisma.$queryRawUnsafe<
      { total: bigint | number }[]
    >(countSql, ...params);
    const total = Number(countResult[0]?.total ?? 0);

    const selectSql = `
      SELECT
        p.id AS id,
        p.name AS name,
        p.sku AS sku,
        p.store_id AS storeId,
        p.manufacturer AS manufacturer,
        p.manufacturer_product_number AS manufacturerProductNumber,
        p.sub_category AS subCategory,
        p.status AS status,
        p.is_featured AS isFeatured,
        p.quantity_in_hand AS quantityInHand,
        p.quantity_ordered AS quantityOrdered,
        p.purchased_price AS purchasedPrice,
        p.expected_date AS expectedDate,
        p.datasheet_url AS datasheetUrl,
        p.product_link AS productLink,
        CAST(p.tags AS CHAR) AS tags,
        p.description AS description,
        p.short_description AS shortDescription,
        p.min_purchase_value AS minPurchaseValue,
        CAST(p.specifications AS CHAR) AS specifications,
        IF(IFNULL(TO_DAYS(p.created_at), 0) = 0, NOW(), p.created_at) AS createdAt,
        IF(IFNULL(TO_DAYS(p.updated_at), 0) = 0, NOW(), p.updated_at) AS updatedAt,
        c.name AS categoryName,
        MAX(CASE WHEN pm.is_thumbnail = 1 THEN m.url ELSE NULL END) AS thumbnailImage,
        COUNT(DISTINCT pm.id) AS imageCount,
        MAX(CASE WHEN pt.min_quantity = 1 THEN pt.price ELSE NULL END) AS price1,
        MAX(CASE WHEN pt.min_quantity = 10 THEN pt.price ELSE NULL END) AS price10,
        MAX(CASE WHEN pt.min_quantity = 100 THEN pt.price ELSE NULL END) AS price100
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      LEFT JOIN product_media pm ON pm.product_id = p.id
      LEFT JOIN media m ON m.id = pm.media_id
      LEFT JOIN product_price_tiers pt ON pt.product_id = p.id
      WHERE ${sqlConditions}
      GROUP BY p.id
      ${orderByClause}
      LIMIT ? OFFSET ?
    `;

    const selectParams: unknown[] = [...params, limit, offset];
    const rows = await this.prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      selectSql,
      ...selectParams,
    );

    return {
      products: rows.map((row) => this.mapListRow(row)),
      total,
      totalPages: Math.ceil(total / limit),
      page,
    };
  }

  // ─── Public: Search ─────────────────────────────────────────────

  async search(searchTerm: string, query: ProductQueryDto) {
    return this.findAll({ ...query, search: searchTerm });
  }


  async findById(id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id },
      select: productDetailSelect,
    });
    if (!product) throw new NotFoundException('Product not found');
    return this.mapToFrontend(product);
  }

  async findBySku(sku: string) {
    const product = await this.prisma.product.findFirst({
      where: { sku },
      select: productDetailSelect,
    });
    if (!product) throw new NotFoundException('Product not found');
    return this.mapToFrontend(product);
  }

  async findBySlug(slug: string) {
    const product = await this.prisma.product.findFirst({
      where: { slug },
      select: productDetailSelect,
    });
    if (!product) throw new NotFoundException('Product not found');
    return this.mapToFrontend(product);
  }
  private toNum(val: unknown): number {
    if (val == null) return 0;
    const n = typeof val === 'string' ? parseFloat(val) : Number(val);
    return isNaN(n) ? 0 : n;
  }

  private parseTags(raw: unknown): string[] {
    if (Array.isArray(raw)) return raw.map(String);
    if (typeof raw !== 'string' || !raw) return [];
    try {
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }

  private parseJson(raw: unknown): unknown {
    if (raw == null) return null;
    if (typeof raw === 'object') return raw;
    if (typeof raw !== 'string' || !raw) return null;
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      return raw;
    }
  }

  private mapRawRowToCatalog(row: Record<string, unknown>) {
    const p1 = this.toNum(row['price1']);
    const p10 = this.toNum(row['price10']) || p1;
    const p100 = this.toNum(row['price100']) || p10;
    const thumbnail =
      (row['thumbnailImage'] as string | null | undefined) || null;
    const imageUrls =
      typeof row['imageUrls'] === 'string'
        ? row['imageUrls']
            .split(',')
            .map((s: string) => s.trim())
            .filter(Boolean)
        : [];
    const otherImages = thumbnail
      ? imageUrls.filter((u: string) => u !== thumbnail)
      : imageUrls;
    return {
      id: row['id'] as string,
      name: row['name'] as string,
      slug: row['slug'] as string,
      sku: row['sku'] as string | undefined,
      description: (row['description'] as string) || '',
      shortDescription: (row['shortDescription'] as string) || '',
      minPurchaseValue: this.toNum(row['minPurchaseValue']),
      specifications: this.parseJson(row['specifications']),
      tags: this.parseTags(row['tags']),
      storeId: row['storeId'] as string | undefined,
      manufacturer: (row['manufacturer'] as string) || '',
      manufacturerProductNumber:
        (row['manufacturerProductNumber'] as string) || '',
      subCategory: (row['subCategory'] as string) || '',
      productLink: row['productLink'] as string | undefined,
      status: row['status'] as string,
      isFeatured: !!Number(row['isFeatured']),
      createdAt: row['createdAt'] as Date,
      updatedAt: row['updatedAt'] as Date,
      categoryId: row['categoryId'] as string,
      category: (row['categoryName'] as string) || '',
      categoryName: (row['categoryName'] as string) || '',
      categorySlug: (row['categorySlug'] as string) || '',
      inHandQty: Number(row['quantityInHand']) || 0,
      orderedQty: Number(row['quantityOrdered']) || 0,
      purchasedPrice: this.toNum(row['purchasedPrice']),
      expectedDate: row['expectedDate'] as string | undefined,
      dataSheet: row['datasheetUrl'] as string | undefined,
      datasheetUrl: row['datasheetUrl'] as string | undefined,
      thumbnailImage: thumbnail,
      images: imageUrls,
      otherImages,
      price1: p1,
      price10: p10,
      price100: p100,
      price_options: { qty1: p1, qty10: p10, qty100: p100 },
      inStock:
        (Number(row['quantityInHand']) || 0) > 0 && row['status'] === 'active',
    };
  }

  private mapListRow(row: Record<string, unknown>) {
    const p1 = this.toNum(row['price1']);
    const p10 = this.toNum(row['price10']) || p1;
    const p100 = this.toNum(row['price100']) || p10;
    return {
      id: row['id'] as string,
      name: row['name'] as string,
      sku: row['sku'] as string | undefined,
      storeId: row['storeId'] as string | undefined,
      manufacturer: (row['manufacturer'] as string) || '',
      manufacturerProductNumber:
        (row['manufacturerProductNumber'] as string) || '',
      subCategory: (row['subCategory'] as string) || '',
      status: row['status'] as string,
      isFeatured: !!Number(row['isFeatured']),
      quantityInHand: Number(row['quantityInHand']) || 0,
      inHandQty: Number(row['quantityInHand']) || 0,
      orderedQty: Number(row['quantityOrdered']) || 0,
      purchasedPrice: this.toNum(row['purchasedPrice']),
      expectedDate: row['expectedDate'] as string | undefined,
      datasheetUrl: row['datasheetUrl'] as string | undefined,
      dataSheet: row['datasheetUrl'] as string | undefined,
      productLink: row['productLink'] as string | undefined,
      description: (row['description'] as string) || '',
      shortDescription: (row['shortDescription'] as string) || '',
      minPurchaseValue: this.toNum(row['minPurchaseValue']),
      specifications: this.parseJson(row['specifications']),
      tags: this.parseTags(row['tags']),
      createdAt: row['createdAt'] as Date,
      updatedAt: row['updatedAt'] as Date,
      category: (row['categoryName'] as string) || '',
      categoryName: (row['categoryName'] as string) || '',
      thumbnailImage:
        (row['thumbnailImage'] as string | null | undefined) || null,
      imageCount: Number(row['imageCount']) || 0,
      price1: p1,
      price10: p10,
      price100: p100,
      inStock:
        (Number(row['quantityInHand']) || 0) > 0 && row['status'] === 'active',
    };
  }

  private mapToFrontend(p: ProductWithRelations) {
    const tiers: any[] = (p.priceTiers as any[]) || [];
    const price1 = this.toNum(tiers.find((t: any) => t.minQuantity === 1)?.price);
    const price10 =
      this.toNum(tiers.find((t: any) => t.minQuantity === 10)?.price) || price1;
    const price100 =
      this.toNum(tiers.find((t: any) => t.minQuantity === 100)?.price) || price10;

    const media: any[] = ((p.productMedia as any[]) || [])
      .sort((a: any, b: any) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
      .map((pm: any) => pm.media)
      .filter((m: any) => !!m);

    const thumbnail =
      ((p.productMedia as any[]) || []).find((pm: any) => pm.isThumbnail)?.media?.url || media[0]?.url;

    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      sku: p.sku,
      description: p.description,
      shortDescription: p.shortDescription,
      minPurchaseValue: this.toNum(p.minPurchaseValue),
      specifications: p.specifications,
      tags: p.tags,
      storeId: p.storeId,
      manufacturer: p.manufacturer || '',
      manufacturerProductNumber: p.manufacturerProductNumber || '',
      mpn: p.manufacturerProductNumber || '',
      subCategory: p.subCategory || '',
      productLink: p.productLink,
      status: p.status,
      isFeatured: p.isFeatured,
      createdAt: p.createdAt ?? new Date(),
      updatedAt: p.updatedAt ?? new Date(),
      categoryId: p.categoryId,
      category: p.category?.name || '',
      categoryName: p.category?.name || '',
      categorySlug: p.category?.slug || '',
      // Field name alignment for admin frontend
      inHandQty: p.quantityInHand ?? 0,
      orderedQty: p.quantityOrdered ?? 0,
      purchasedPrice: this.toNum(p.purchasedPrice),
      expectedDate: p.expectedDate,
      dataSheet: p.datasheetUrl,
      datasheetUrl: p.datasheetUrl,
      // Image alignment
      thumbnailImage: thumbnail || null,
      images: media.map((m: any) => m.url).filter(Boolean),
      otherImages: media
        .filter((m: any) => m.url && m.url !== thumbnail)
        .map((m: any) => m.url),
      // Pricing alignment (convert MySQL decimal strings to numbers)
      price1,
      price10,
      price100,
      price_options: {
        qty1: price1,
        qty10: price10,
        qty100: price100,
      },
      // Product attributes
      attributes: (p.productAttributes || []).map((pa: any) => ({
        id: pa.id,
        attributeId: pa.attributeId,
        name: pa.attribute?.name || '',
        value: pa.value,
        isSimilarFilter: pa.isSimilarFilter,
      })),
      attributeFilters: (p.productAttributes || [])
        .filter((pa: any) => pa.isSimilarFilter)
        .map((pa: any) => ({
          id: pa.attributeId,
          name: pa.attribute?.name || '',
          value: pa.value,
        })),

      // Electronics UI alignment
      inStock: (p.quantityInHand ?? 0) > 0 && p.status === 'active',
    };
  }

  // ─── Public: Prices via ProductPriceTier ────────────────────────

  async getPrices(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        purchasedPrice: true,
        priceTiers: true,
      },
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async getPriceTiers(productId: string) {
    return this.prisma.productPriceTier.findMany({
      where: { productId },
      orderBy: { minQuantity: 'asc' },
    });
  }

  // ─── Public: Related products ───────────────────────────────────

  async getRelated(id: string) {
    const product = await this.findById(id);
    return this.prisma.product.findMany({
      where: {
        categoryId: product.categoryId,
        id: { not: id },
        deletedAt: null,
      },
      include: {
        category: true,
        priceTiers: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 10,
    });
  }

  async getAttributes() {
    return this.prisma.$queryRawUnsafe<
      { id: string; name: string; key: string }[]
    >('SELECT id, name, `key` FROM attributes ORDER BY name ASC');
  }

  async findSimilar(query: ProductQueryDto) {
    return this.findAllCatalog({
      ...query,
      limit: query.limit || 12,
    });
  }

  private async setAttributes(
    productId: string,
    attributes: ProductAttributeDto[],
  ) {
    if (!attributes) return;

    await this.prisma.$executeRawUnsafe(
      'DELETE FROM product_attributes WHERE product_id = ?',
      productId,
    );

    for (const attr of attributes) {
      if (!attr.name?.trim() || !attr.value?.trim()) continue;
      const name = attr.name.trim();
      const key = name
        .toLowerCase()
        .replace(/[^\w]+/g, '-')
        .replace(/^-+|-+$/g, '');

      const existing: any[] = await this.prisma.$queryRawUnsafe(
        'SELECT id FROM attributes WHERE name = ? OR `key` = ? LIMIT 1',
        name,
        key,
      );

      let attributeId: string;
      if (existing.length) {
        attributeId = existing[0].id;
      } else {
        await this.prisma.$executeRawUnsafe(
          'INSERT INTO attributes (id, name, `key`) VALUES (UUID(), ?, ?)',
          name,
          key,
        );
        const created: any[] = await this.prisma.$queryRawUnsafe(
          'SELECT id FROM attributes WHERE `key` = ? LIMIT 1',
          key,
        );
        attributeId = created[0]?.id;
      }

      if (!attributeId) continue;

      await this.prisma.$executeRawUnsafe(
        'INSERT INTO product_attributes (id, product_id, attribute_id, value, is_similar_filter) VALUES (UUID(), ?, ?, ?, ?)',
        productId,
        attributeId,
        attr.value.trim(),
        attr.isSimilarFilter ? 1 : 0,
      );
    }
  }

  // ─── Public: Stock check ────────────────────────────────────────

  async checkStock(productId: string, requestedQty: number) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        name: true,
        quantityInHand: true,
        status: true,
      },
    });
    if (!product) throw new NotFoundException('Product not found');

    return {
      available:
        product.quantityInHand >= requestedQty && product.status === 'active',
      currentStock: product.quantityInHand,
      status: product.status,
    };
  }

  // ─── Admin: Create ──────────────────────────────────────────────

  async create(
    dto: CreateProductDto,
    thumbnail?: Express.Multer.File,
    images?: Express.Multer.File[],
  ) {
    const slug = await this.uniqueSlug(this.generateSlug(dto.name));
    const productLink = slug;

    const { price1, price10, price100, ...productFields } = dto;

    const categoryId = await this.resolveOrCreateCategory(
      productFields.categoryId,
      productFields.categoryName,
    );
    const subCategoryId = await this.resolveOrCreateSubCategory(
      productFields.subCategory,
      categoryId,
    );

    const saved = await this.prisma.product.create({
      data: {
        name: productFields.name,
        sku: productFields.sku,
        description: productFields.description,
        shortDescription: productFields.shortDescription,
        minPurchaseValue: productFields.minPurchaseValue ?? null,
        specifications:
          (productFields.specifications as Prisma.InputJsonValue) ?? {},
        tags: productFields.tags ?? [],
        datasheetUrl: productFields.datasheetUrl,
        model3dUrl: productFields.model3dUrl,
        productLink,
        slug,
        subCategory: productFields.subCategory,
        subCategoryRecord: subCategoryId ? { connect: { id: subCategoryId } } : undefined,
        storeId: productFields.storeId,
        manufacturer: productFields.manufacturer,
        manufacturerProductNumber: productFields.manufacturerProductNumber,
        quantityInHand: productFields.quantityInHand ?? 0,
        quantityOrdered: productFields.quantityOrdered ?? 0,
        purchasedPrice: productFields.purchasedPrice ?? null,
        expectedDate: productFields.expectedDate
          ? new Date(productFields.expectedDate)
          : null,
        status: productFields.status ?? 'active',
        isFeatured: productFields.isFeatured ?? false,
        category: categoryId ? { connect: { id: categoryId } } : undefined,
      },
    });

    const tiers = this.buildPriceTiers(price1, price10, price100);
    if (tiers.length > 0) {
      await this.setPriceTiers(saved.id, tiers);
    }

    await this.handleImageUploads(saved.id, dto.name, thumbnail, images);
    await this.setAttributes(saved.id, dto.attributes || []);

    void this.cacheService.clear();
    return this.findById(saved.id);
  }

  // ─── Admin: Update ──────────────────────────────────────────────

  async update(
    id: string,
    dto: UpdateProductDto,
    thumbnail?: Express.Multer.File,
    images?: Express.Multer.File[],
  ) {
    const existing = await this.prisma.product.findUnique({
      where: { id },
      select: { categoryId: true },
    });
    if (!existing) throw new NotFoundException('Product not found');

    const updateDto = dto as Partial<CreateProductDto> & {
      price1?: number;
      price10?: number;
      price100?: number;
    };
    const { price1, price10, price100, ...productFields } = updateDto;

    const updateData: Prisma.ProductUpdateInput = {};
    let resolvedCategoryId: string | null | undefined = existing.categoryId;
    if (productFields.name !== undefined) {
      updateData.name = productFields.name;
      const slug = await this.uniqueSlug(
        this.generateSlug(productFields.name),
        id,
      );
      updateData.slug = slug;
      updateData.productLink = slug;
    }
    if (productFields.sku !== undefined)
      updateData.sku = productFields.sku || null; // '' would collide on the unique index
    if (productFields.description !== undefined)
      updateData.description = productFields.description;
    if (productFields.shortDescription !== undefined)
      updateData.shortDescription = productFields.shortDescription;
    if (productFields.minPurchaseValue !== undefined)
      updateData.minPurchaseValue = productFields.minPurchaseValue;
    if (productFields.specifications !== undefined)
      // Nullable Json fields reject plain null — must use Prisma.DbNull
      updateData.specifications =
        productFields.specifications ?? Prisma.DbNull;
    if (productFields.tags !== undefined) updateData.tags = productFields.tags;
    if (productFields.datasheetUrl !== undefined)
      updateData.datasheetUrl = productFields.datasheetUrl;
    if (productFields.model3dUrl !== undefined)
      updateData.model3dUrl = productFields.model3dUrl;
    if (productFields.subCategory !== undefined)
      updateData.subCategory = productFields.subCategory;
    if (productFields.storeId !== undefined)
      updateData.storeId = productFields.storeId;
    if (productFields.manufacturer !== undefined)
      updateData.manufacturer = productFields.manufacturer;
    if (productFields.manufacturerProductNumber !== undefined)
      updateData.manufacturerProductNumber =
        productFields.manufacturerProductNumber;
    if (productFields.quantityInHand !== undefined)
      updateData.quantityInHand = productFields.quantityInHand;
    if (productFields.quantityOrdered !== undefined)
      updateData.quantityOrdered = productFields.quantityOrdered;
    if (productFields.purchasedPrice !== undefined)
      updateData.purchasedPrice = productFields.purchasedPrice;
    if (productFields.expectedDate !== undefined) {
      updateData.expectedDate = productFields.expectedDate
        ? new Date(productFields.expectedDate)
        : null;
    }
    if (productFields.status !== undefined)
      updateData.status = productFields.status;
    if (productFields.isFeatured !== undefined)
      updateData.isFeatured = productFields.isFeatured;
    if (productFields.categoryId !== undefined || productFields.categoryName !== undefined) {
      const resolved = productFields.categoryId
        ? productFields.categoryId
        : await this.resolveOrCreateCategory(undefined, productFields.categoryName);
      resolvedCategoryId = resolved;
      updateData.category = resolved
        ? { connect: { id: resolved } }
        : { disconnect: true };
    }

    if (productFields.subCategory !== undefined) {
      const subCategoryId = productFields.subCategory?.trim()
        ? await this.resolveOrCreateSubCategory(productFields.subCategory, resolvedCategoryId)
        : null;
      updateData.subCategory = productFields.subCategory;
      updateData.subCategoryRecord = subCategoryId
        ? { connect: { id: subCategoryId } }
        : { disconnect: true };
    }

    await this.prisma.product.update({
      where: { id },
      data: updateData,
    });

    if (
      price1 !== undefined ||
      price10 !== undefined ||
      price100 !== undefined
    ) {
      const tiers = this.buildPriceTiers(price1, price10, price100);
      if (tiers.length > 0) {
        await this.setPriceTiers(id, tiers);
      }
    }

    await this.handleImageUploads(id, dto.name || '', thumbnail, images);
    if (dto.attributes !== undefined) {
      await this.setAttributes(id, dto.attributes || []);
    }

    void this.cacheService.clear();
    return this.findById(id);
  }

  private async handleImageUploads(
    productId: string,
    name: string,
    thumbnail?: Express.Multer.File,
    images?: Express.Multer.File[],
  ) {
    if (thumbnail) {
      await this.imagesService.addThumbnail(
        productId,
        thumbnail,
        name,
        'products',
      );
    }
    if (images?.length) {
      await this.imagesService.addImages(productId, images, name, 'products');
    }
  }

  // ─── Admin: Delete ──────────────────────────────────────────────

  async softDelete(id: string) {
    await this.findById(id);
    await this.prisma.product.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    void this.cacheService.clear();
    return { message: 'Product deleted' };
  }

  // ─── Admin: Status / Stock ──────────────────────────────────────

  async updateStatus(id: string, dto: UpdateProductStatusDto) {
    await this.findById(id);
    const updateData: Prisma.ProductUpdateInput = {};
    if (dto.status !== undefined) updateData.status = dto.status;
    if (dto.quantityInHand !== undefined)
      updateData.quantityInHand = dto.quantityInHand;
    if (dto.isFeatured !== undefined) updateData.isFeatured = dto.isFeatured;
    await this.prisma.product.update({
      where: { id },
      data: updateData,
    });
    void this.cacheService.clear();
    return this.findById(id);
  }

  // ─── Admin: Specifications (JSON) ──────────────────────────────

  async updateSpecifications(
    id: string,
    specifications: Record<string, string>[],
  ) {
    await this.findById(id);
    await this.prisma.product.update({
      where: { id },
      data: { specifications },
    });
    void this.cacheService.clear();
    return this.findById(id);
  }

  // ─── Admin: Price tiers ─────────────────────────────────────────

  async setPriceTiers(
    productId: string,
    tiers: { minQuantity: number; price: number }[],
  ) {
    await this.findById(productId);
    await this.prisma.productPriceTier.deleteMany({ where: { productId } });

    await this.prisma.productPriceTier.createMany({
      data: tiers.map((t) => ({
        productId,
        minQuantity: t.minQuantity,
        price: t.price,
      })),
    });
    void this.cacheService.clear();
    return this.findById(productId);
  }

  // ─── Admin: Count ───────────────────────────────────────────────

  async count() {
    const total = await this.prisma.product.count();
    const active = await this.prisma.product.count({
      where: { status: 'active' },
    });
    const outOfStock = await this.prisma.product.count({
      where: { status: 'out_of_stock' },
    });
    const discontinued = await this.prisma.product.count({
      where: { status: 'discontinued' },
    });
    return { total, active, outOfStock, discontinued };
  }

  // ─── Admin: By category ─────────────────────────────────────────

  async findByCategory(categoryId: string, query: ProductQueryDto) {
    const { page = 1, limit = 20 } = query;
    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where: { categoryId },
        include: {
          category: true,
          priceTiers: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.product.count({
        where: { categoryId },
      }),
    ]);
    return { products, total, totalPages: Math.ceil(total / limit), page };
  }

  // ─── Helpers ────────────────────────────────────────────────────

  private buildPriceTiers(
    price1?: number,
    price10?: number,
    price100?: number,
  ): { minQuantity: number; price: number }[] {
    const tiers: { minQuantity: number; price: number }[] = [];
    if (price1 != null) tiers.push({ minQuantity: 1, price: price1 });
    if (price10 != null) tiers.push({ minQuantity: 10, price: price10 });
    if (price100 != null) tiers.push({ minQuantity: 100, price: price100 });
    return tiers;
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /** Returns base slug, or base-2/-3/… if already taken by another product. */
  private async uniqueSlug(base: string, excludeId?: string): Promise<string> {
    let slug = base;
    let counter = 2;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const existing = await this.prisma.product.findFirst({
        where: {
          slug,
          ...(excludeId ? { id: { not: excludeId } } : {}),
        },
        select: { id: true },
      });
      if (!existing) return slug;
      slug = `${base}-${counter++}`;
    }
  }
}
