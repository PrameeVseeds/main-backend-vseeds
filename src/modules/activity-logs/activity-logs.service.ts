/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EncryptionService } from '../../common/services/encryption.service';
import { ActivityLog } from '@prisma/client';
import { ENTITY_TABLE_MAP } from './activity-logging.config';
import { TokenBlacklistService } from '../../common/services/token-blacklist.service';
import { CreateActivityLogDto } from './dto/create-activity-log.dto';
import { ActivityLogQueryDto } from './dto/activity-log-query.dto';

const LOGGABLE_ACTIONS = ['login', 'create', 'update', 'delete'];

@Injectable()
export class ActivityLogsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenBlacklist: TokenBlacklistService,
    private readonly encryptionService: EncryptionService,
  ) {}

  async create(dto: CreateActivityLogDto) {
    return this.prisma.activityLog.create({
      data: {
        actorId: dto.actorId ?? null,
        actorType: dto.actorType ?? 'system',
        action: dto.action,
        entityType: dto.entityType,
        entityId: dto.entityId ?? null,
        description: dto.description ?? null,
        ipAddress: dto.ipAddress ?? null,
        userAgent: dto.userAgent ?? null,
        metadata: dto.metadata ?? null,
      },
    });
  }

  async findOne(id: string) {
    const log = await this.prisma.activityLog.findUnique({ where: { id } });
    if (!log) return null;
    const withActors = await this.resolveActorNames([log]);
    const enriched = await this.resolveEntityDisplayNames(withActors);
    const [decrypted] = this.decryptSensitiveFields(enriched);
    return decrypted;
  }

  async findAll(query: ActivityLogQueryDto) {
    const where: any = {
      action: {
        in: LOGGABLE_ACTIONS,
      },
    };

    if (query.actor_id) where.actorId = query.actor_id;
    if (query.actor_type) where.actorType = query.actor_type;
    if (query.action) where.action = query.action;
    if (query.entity_type) where.entityType = query.entity_type;
    if (query.entity_id) where.entityId = query.entity_id;
    if (query.start_date || query.end_date) {
      where.createdAt = {};
      if (query.start_date) where.createdAt.gte = new Date(query.start_date);
      if (query.end_date) where.createdAt.lte = new Date(query.end_date);
    }

    const [logs, total] = await this.prisma.$transaction([
      this.prisma.activityLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: query.offset || 0,
        take: query.limit || 50,
      }),
      this.prisma.activityLog.count({ where }),
    ]);

    const withActors = await this.resolveActorNames(logs);
    const enriched = await this.resolveEntityDisplayNames(withActors);
    const decrypted = this.decryptSensitiveFields(enriched);
    return { logs: decrypted, total };
  }

  private async resolveActorNames(logs: ActivityLog[]) {
    const adminIds = [
      ...new Set(
        logs
          .filter((l) => l.actorType === 'admin' && l.actorId)
          .map((l) => l.actorId!),
      ),
    ];
    const userIds = [
      ...new Set(
        logs
          .filter((l) => l.actorType === 'user' && l.actorId)
          .map((l) => l.actorId!),
      ),
    ];

    const adminMap = new Map<
      string,
      { name: string; email: string; role: string }
    >();
    const userMap = new Map<
      string,
      { name: string; email: string; role: string }
    >();

    if (adminIds.length) {
      const admins = await this.prisma.admin.findMany({
        where: { id: { in: adminIds } },
        select: {
          id: true,
          username: true,
          email: true,
          role: { select: { name: true } },
        },
      });
      admins.forEach((a) =>
        adminMap.set(a.id, {
          name: this.encryptionService.decrypt(a.username) || this.encryptionService.decrypt(a.email),
          email: this.encryptionService.decrypt(a.email),
          role: a.role?.name || 'admin',
        }),
      );
    }
    if (userIds.length) {
      const users = await this.prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, firstName: true, email: true },
      });
      users.forEach((u) =>
        userMap.set(u.id, {
          name: u.firstName || this.encryptionService.decrypt(u.email),
          email: this.encryptionService.decrypt(u.email),
          role: 'customer',
        }),
      );
    }

    return logs.map((log) => {
      let actor = { name: 'System', email: '', role: 'system' };
      if (log.actorType === 'admin' && log.actorId) {
        actor = adminMap.get(log.actorId) || {
          name: `Admin #${log.actorId}`,
          email: '',
          role: 'admin',
        };
      } else if (log.actorType === 'user' && log.actorId) {
        actor = userMap.get(log.actorId) || {
          name: `User #${log.actorId}`,
          email: '',
          role: 'customer',
        };
      }
      return {
        ...log,
        actorName: actor.name,
        actorEmail: actor.email,
        actorRole: actor.role,
      };
    });
  }

  /** Batch-resolve human-readable labels for entity_id + entity_type (single list API, no N+1). */
  private async resolveEntityDisplayNames(logs: any[]): Promise<any[]> {
    const byType = new Map<string, string[]>();
    for (const log of logs) {
      const id = log.entityId?.trim();
      if (!id || !log.entityType) continue;
      const list = byType.get(log.entityType) ?? [];
      if (!list.includes(id)) list.push(id);
      byType.set(log.entityType, list);
    }

    const labelMap = new Map<string, string>();
    for (const [entityType, ids] of byType) {
      if (!ids.length) continue;
      const batch = await this.batchEntityLabels(entityType, ids);
      batch.forEach((label, trimmedId) => {
        labelMap.set(`${entityType}:${trimmedId}`, label);
      });
    }

    return logs.map((log) => {
      const id = log.entityId?.trim();
      let entityDisplayName: string | undefined;
      if (id && log.entityType) {
        entityDisplayName = labelMap.get(`${log.entityType}:${id}`);
        if (!entityDisplayName) {
          entityDisplayName = this.shortEntityIdFallback(id);
        }
      }
      return { ...log, entityDisplayName };
    });
  }

  private shortEntityIdFallback(entityId: string): string {
    const t = entityId.trim();
    return t.length >= 8 ? `…${t.slice(-8)}` : t || '—';
  }

  /** One batched query per entity type; returns map trimmedId -> display label. */
  private async batchEntityLabels(
    entityType: string,
    ids: string[],
  ): Promise<Map<string, string>> {
    const out = new Map<string, string>();
    if (!ids.length) return out;

    try {
      if (entityType === 'wishlist') {
        const placeholders = ids.map(() => '?').join(',');
        const rows = await this.prisma.$queryRawUnsafe<any[]>(
          `SELECT TRIM(w.id) AS id, p.name AS label FROM wishlists w INNER JOIN products p ON TRIM(p.id) = TRIM(w.product_id) WHERE TRIM(w.id) IN (${placeholders})`,
          ...ids,
        );
        for (const row of rows) {
          const id = String(row.id ?? '').trim();
          const label = String(row.label ?? '').trim();
          if (id && label) out.set(id, label);
        }
        return out;
      }

      const config = ENTITY_TABLE_MAP[entityType];
      if (!config?.nameCol) return out;

      const { table, nameCol } = config;
      if (
        !/^[a-z_][a-z0-9_]*$/i.test(table) ||
        !/^[a-z_][a-z0-9_]*$/i.test(nameCol)
      ) {
        return out;
      }

      const placeholders = ids.map(() => '?').join(',');
      const rows = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT TRIM(t.id) AS id, t.\`${nameCol}\` AS disp FROM \`${table}\` t WHERE TRIM(t.id) IN (${placeholders})`,
        ...ids,
      );

      for (const row of rows) {
        const id = String(row.id ?? '').trim();
        const rawDisp = row.disp ?? (row as Record<string, unknown>).DISP;
        let label =
          rawDisp != null && rawDisp !== undefined
            ? String(rawDisp).trim()
            : '';
        if (entityType === 'review' && label.length > 80) {
          label = `${label.slice(0, 77)}…`;
        }
        if (id && label) out.set(id, label);
      }
    } catch {
      // leave out empty; resolveEntityDisplayNames will use short id fallback
    }

    return out;
  }

  async findRecent(days: number = 7, limit: number = 20) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    return this.prisma.activityLog.findMany({
      where: {
        action: { in: LOGGABLE_ACTIONS },
        createdAt: { gte: since },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async findRecentRaw(days: number = 7, limit: number = 20) {
    return this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM activity_logs WHERE action IN ('login','create','update','delete') AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY) ORDER BY created_at DESC LIMIT ?`,
      days,
      limit,
    );
  }

  private decryptSensitiveFields(logs: any[]): any[] {
    return logs.map(log => {
      const decrypted = { ...log };
      
      // Decrypt description if it contains encrypted data
      if (decrypted.description && typeof decrypted.description === 'string') {
        decrypted.description = this.decryptStringIfEncrypted(decrypted.description);
      }
      
      // Decrypt entityDisplayName if it contains encrypted data
      if (decrypted.entityDisplayName && typeof decrypted.entityDisplayName === 'string') {
        decrypted.entityDisplayName = this.decryptStringIfEncrypted(decrypted.entityDisplayName);
      }
      
      // Decrypt metadata fields
      if (decrypted.metadata && typeof decrypted.metadata === 'object') {
        decrypted.metadata = this.decryptMetadata(decrypted.metadata);
      }
      
      return decrypted;
    });
  }

  private decryptStringIfEncrypted(str: string): string {
    if (str.startsWith('ENC:v1:')) {
      try {
        return this.encryptionService.decrypt(str);
      } catch {
        return str; // Return original if decryption fails
      }
    }
    
    // Handle cases where encrypted string is embedded within text (e.g., "Delete admin \"ENC:v1:...\"")
    const encryptedPattern = /ENC:v1:[^"]+/g;
    if (encryptedPattern.test(str)) {
      try {
        return str.replace(encryptedPattern, (match) => {
          try {
            return this.encryptionService.decrypt(match);
          } catch {
            return match; // Keep original if decryption fails
          }
        });
      } catch {
        return str;
      }
    }
    
    return str;
  }

  private decryptMetadata(metadata: any): any {
    if (!metadata || typeof metadata !== 'object') return metadata;
    
    const decrypted = { ...metadata };
    
    // Decrypt oldData and newData if they exist
    if (decrypted.oldData && typeof decrypted.oldData === 'object') {
      decrypted.oldData = this.decryptObjectFields(decrypted.oldData);
    }
    
    if (decrypted.newData && typeof decrypted.newData === 'object') {
      decrypted.newData = this.decryptObjectFields(decrypted.newData);
    }
    
    return decrypted;
  }

  private decryptObjectFields(obj: any): any {
    if (!obj || typeof obj !== 'object') return obj;
    
    const decrypted = { ...obj };
    const encryptedFields = ['username', 'email', 'bankName', 'branch', 'accountNumber', 'accountName', 'code', 'customerEmail'];
    
    for (const field of encryptedFields) {
      if (decrypted[field] && typeof decrypted[field] === 'string' && decrypted[field].startsWith('ENC:v1:')) {
        try {
          decrypted[field] = this.encryptionService.decrypt(decrypted[field]);
        } catch {
          // Keep original if decryption fails
        }
      }
    }
    
    return decrypted;
  }

  // OPT: Pagination added; response shape { logs, total, totalPages, page } when page/limit provided (see plan).
  async findByUser(
    actorId: string,
    pagination?: { page?: number; limit?: number },
  ) {
    const page = pagination?.page ?? 1;
    const limit = Math.min(100, Math.max(1, pagination?.limit ?? 50));

    const where = {
      actorId,
      action: { in: LOGGABLE_ACTIONS },
    };

    const [logs, total] = await this.prisma.$transaction([
      this.prisma.activityLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.activityLog.count({ where }),
    ]);

    return { logs, total, totalPages: Math.ceil(total / limit), page };
  }

  async findByEntity(
    entityType: string,
    entityId: string,
    pagination?: { page?: number; limit?: number },
  ) {
    const page = pagination?.page ?? 1;
    const limit = Math.min(100, Math.max(1, pagination?.limit ?? 50));

    const where = {
      entityType,
      entityId,
      action: { in: LOGGABLE_ACTIONS },
    };

    const [logs, total] = await this.prisma.$transaction([
      this.prisma.activityLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.activityLog.count({ where }),
    ]);

    return { logs, total, totalPages: Math.ceil(total / limit), page };
  }

  async getNotifications(days: number = 7, limit: number = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const [recentOrders, recentQuotes] = await Promise.all([
      this.prisma.order.findMany({
        select: {
          id: true,
          orderNumber: true,
          userId: true,
          totalAmount: true,
          status: true,
          orderType: true,
          createdAt: true,
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
        where: { createdAt: { gte: since } },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      this.prisma.quote.findMany({
        select: {
          id: true,
          quoteNumber: true,
          customerName: true,
          customerEmail: true,
          serviceType: true,
          totalPrice: true,
          status: true,
          createdAt: true,
        },
        where: { createdAt: { gte: since } },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
    ]);

    const orders = recentOrders.map((o) => ({
      id: o.id,
      type: 'order' as const,
      source: 'electronics-vseeds',
      orderNumber: o.orderNumber,
      customerName: o.user
        ? `${o.user.firstName ?? ''} ${o.user.lastName ?? ''}`.trim() ||
          o.user.email
        : `User #${o.userId}`,
      customerEmail: o.user?.email ?? '',
      totalAmount: Number(o.totalAmount),
      status: o.status,
      createdAt: o.createdAt,
    }));

    const quotes = recentQuotes.map((q) => ({
      id: q.id,
      type: 'quote' as const,
      source: 'embedded-vseeds',
      quoteNumber: q.quoteNumber,
      customerName: q.customerName,
      customerEmail: q.customerEmail,
      serviceType: q.serviceType,
      totalPrice: q.totalPrice ? Number(q.totalPrice) : null,
      status: q.status,
      createdAt: q.createdAt,
    }));

    const all = [...orders, ...quotes].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    return {
      notifications: all.slice(0, limit),
      orderCount: orders.length,
      quoteCount: quotes.length,
    };
  }

  async getStatistics(days: number = 30) {
    const [totalResult] = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT COUNT(*) as total FROM activity_logs WHERE action IN ('login','create','update','delete') AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)`,
      days,
    );

    const byEntityType = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT entity_type, COUNT(*) as count FROM activity_logs WHERE action IN ('login','create','update','delete') AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY) GROUP BY entity_type ORDER BY count DESC`,
      days,
    );

    const byActorType = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT actor_type, COUNT(*) as count FROM activity_logs WHERE action IN ('login','create','update','delete') AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY) GROUP BY actor_type ORDER BY count DESC`,
      days,
    );

    const byAction = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT action, COUNT(*) as count FROM activity_logs WHERE action IN ('login','create','update','delete') AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY) GROUP BY action ORDER BY count DESC`,
      days,
    );

    return {
      total: Number(totalResult?.total || 0),
      days,
      byEntityType,
      byActorType,
      byAction,
    };
  }

  async deleteOne(id: string) {
    const log = await this.prisma.activityLog.findUnique({ where: { id } });
    if (!log) return { message: 'Not found' };

    const metadataObj = log.metadata as any;
    const sessionToken = metadataObj?.sessionToken;
    if (sessionToken) {
      this.tokenBlacklist.revoke(sessionToken);
    }

    await this.prisma.activityLog.delete({ where: { id } });
    return { message: 'Session revoked and removed' };
  }

  async cleanOldLogs(days: number = 90) {
    const result = await this.prisma.$queryRawUnsafe<any>(
      `DELETE FROM activity_logs WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)`,
      days,
    );
    return {
      message: `Cleaned logs older than ${days} days`,
      affected: result?.affectedRows || 0,
    };
  }
}
