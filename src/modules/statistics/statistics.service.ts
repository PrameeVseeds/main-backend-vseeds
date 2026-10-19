import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class StatisticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getBasicStats() {
    const [categories, products, activeProducts, lowStock, outOfStock] =
      await Promise.all([
        this.count('categories', 'deleted_at IS NULL'),
        this.count('products', 'deleted_at IS NULL'),
        this.count('products', "status = 'active' AND deleted_at IS NULL"),
        this.count(
          'products',
          'quantity_in_hand <= 10 AND quantity_in_hand > 0 AND deleted_at IS NULL',
        ),
        this.count('products', 'quantity_in_hand = 0 AND deleted_at IS NULL'),
      ]);

    return { categories, products, activeProducts, lowStock, outOfStock };
  }

  async getDetailedStats() {
    const [basic, orders, users, quotes, revenue] = await Promise.all([
      this.getBasicStats(),
      this.getOrderStats(),
      this.getUserStats(),
      this.getQuoteStats(),
      this.getRevenueStats(),
    ]);

    return { ...basic, ...orders, ...users, ...quotes, ...revenue };
  }

  async getCategoryStats() {
    const rows = await this.prisma.$queryRawUnsafe<unknown[]>(`
      SELECT c.id, c.name, c.status,
        COUNT(p.id) as productCount,
        SUM(CASE WHEN p.status = 'active' THEN 1 ELSE 0 END) as activeProductCount
      FROM categories c
      LEFT JOIN products p ON c.id = p.category_id AND p.deleted_at IS NULL
      WHERE c.deleted_at IS NULL
      GROUP BY c.id, c.name, c.status
      ORDER BY productCount DESC
    `);
    return rows;
  }

  async getProductsByCategory() {
    const rows = await this.prisma.$queryRawUnsafe<unknown[]>(`
      SELECT c.name as category, COUNT(p.id) as productCount
      FROM categories c
      LEFT JOIN products p ON c.id = p.category_id AND p.deleted_at IS NULL
      WHERE c.deleted_at IS NULL
      GROUP BY c.id, c.name
      ORDER BY productCount DESC
    `);
    return rows;
  }

  async getInventoryInsights() {
    const [valueResult] = await this.prisma.$queryRawUnsafe<
      Array<{
        totalValue: string | number | null;
        averagePrice: string | number | null;
        totalUnits: string | number | null;
      }>
    >(`
      SELECT
        SUM(pt.price * p.quantity_in_hand) as totalValue,
        AVG(pt.price) as averagePrice,
        SUM(p.quantity_in_hand) as totalUnits
      FROM products p
      LEFT JOIN product_price_tiers pt ON p.id = pt.product_id AND pt.min_quantity = 1
      WHERE p.deleted_at IS NULL
    `);

    const topCategories = await this.prisma.$queryRawUnsafe<unknown[]>(`
      SELECT c.name, COUNT(p.id) as productCount
      FROM categories c
      LEFT JOIN products p ON c.id = p.category_id AND p.deleted_at IS NULL
      WHERE c.deleted_at IS NULL
      GROUP BY c.id, c.name
      ORDER BY productCount DESC
      LIMIT 5
    `);

    const lowStockProducts = await this.prisma.$queryRawUnsafe<unknown[]>(`
      SELECT id, name, quantity_in_hand as quantityInHand
      FROM products
      WHERE quantity_in_hand <= 10 AND quantity_in_hand > 0 AND deleted_at IS NULL
      ORDER BY quantity_in_hand ASC
      LIMIT 10
    `);

    return {
      totalInventoryValue: valueResult?.totalValue
        ? Number(valueResult.totalValue)
        : 0,
      averageProductPrice: valueResult?.averagePrice
        ? Number(valueResult.averagePrice)
        : 0,
      totalUnits: valueResult?.totalUnits ? Number(valueResult.totalUnits) : 0,
      topCategories,
      lowStockProducts,
    };
  }

  async getTrends(period: string = '30d') {
    const days = this.parsePeriod(period);
    const interval = `INTERVAL ${days} DAY`;

    const [newProducts, newCategories, newOrders, newUsers] = await Promise.all(
      [
        this.count(
          'products',
          `created_at >= DATE_SUB(NOW(), ${interval}) AND deleted_at IS NULL`,
        ),
        this.count(
          'categories',
          `created_at >= DATE_SUB(NOW(), ${interval}) AND deleted_at IS NULL`,
        ),
        this.count('orders', `created_at >= DATE_SUB(NOW(), ${interval})`),
        this.count('users', `created_at >= DATE_SUB(NOW(), ${interval})`),
      ],
    );

    return { period, days, newProducts, newCategories, newOrders, newUsers };
  }

  async getPriceRanges() {
    const rows = await this.prisma.$queryRawUnsafe<unknown[]>(`
      SELECT
        CASE
          WHEN pt.price < 1000 THEN 'Under 1000'
          WHEN pt.price BETWEEN 1000 AND 5000 THEN '1000-5000'
          WHEN pt.price BETWEEN 5001 AND 10000 THEN '5001-10000'
          WHEN pt.price BETWEEN 10001 AND 50000 THEN '10001-50000'
          ELSE 'Over 50000'
        END as priceRange,
        COUNT(DISTINCT p.id) as count
      FROM products p
      INNER JOIN product_price_tiers pt ON p.id = pt.product_id AND pt.min_quantity = 1
      WHERE p.deleted_at IS NULL
      GROUP BY priceRange
      ORDER BY MIN(pt.price)
    `);
    return rows;
  }

  // ─── Helpers ────────────────────────────────────────────────────

  private async getOrderStats() {
    const [total, pending, processing, delivered] = await Promise.all([
      this.count('orders'),
      this.count('orders', "status = 'pending'"),
      this.count('orders', "status = 'processing'"),
      this.count('orders', "status = 'delivered'"),
    ]);
    return {
      totalOrders: total,
      pendingOrders: pending,
      processingOrders: processing,
      deliveredOrders: delivered,
    };
  }

  private async getUserStats() {
    const [total, newThisMonth] = await Promise.all([
      this.count('users'),
      this.count('users', 'created_at >= DATE_SUB(NOW(), INTERVAL 1 MONTH)'),
    ]);
    return { totalUsers: total, newUsersThisMonth: newThisMonth };
  }

  private async getQuoteStats() {
    const [total, pending] = await Promise.all([
      this.count('quotes'),
      this.count('quotes', "status = 'pending'"),
    ]);
    return { totalQuotes: total, pendingQuotes: pending };
  }

  private async getRevenueStats() {
    const [result] = await this.prisma.$queryRawUnsafe<
      Array<{ totalRevenue: string | number }>
    >(`
      SELECT COALESCE(SUM(total_amount), 0) as totalRevenue
      FROM orders WHERE status NOT IN ('cancelled', 'refunded')
    `);
    return {
      totalRevenue: result?.totalRevenue ? Number(result.totalRevenue) : 0,
    };
  }

  private async count(table: string, where?: string): Promise<number> {
    const query = where
      ? `SELECT COUNT(*) as c FROM ${table} WHERE ${where}`
      : `SELECT COUNT(*) as c FROM ${table}`;
    try {
      const [row] =
        await this.prisma.$queryRawUnsafe<Array<{ c: string | number }>>(query);
      return Number(row?.c || 0);
    } catch {
      return 0;
    }
  }

  private parsePeriod(period: string): number {
    const map: Record<string, number> = {
      '7d': 7,
      '30d': 30,
      '90d': 90,
      '1y': 365,
    };
    return map[period] || 30;
  }
}
