import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, from, switchMap, tap, of } from 'rxjs';
import { PrismaService } from '../../prisma/prisma.service';
import { Request } from 'express';
import { ActivityLogsService } from './activity-logs.service';
import {
  SKIP_PATHS,
  LOGIN_PATHS,
  LOGGABLE_METHODS,
  LOGGED_ENTITIES,
  ALWAYS_LOG_DELETE,
  METHOD_ACTION_MAP,
  ENTITY_TABLE_MAP,
  SENSITIVE_FIELDS,
  PATH_SEGMENT_TO_ENTITY,
} from './activity-logging.config';

interface CustomRequest extends Omit<Request, 'body'> {
  user?: {
    id?: string;
    type?: string;
  };
  body: Record<string, unknown>;
}

interface LoggablesResponse {
  id?: string;
  accessToken?: string;
  user?: {
    id?: string;
  };
  data?: {
    id?: string;
    accessToken?: string;
    user?: {
      id?: string;
    };
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

@Injectable()
export class ActivityLoggingInterceptor implements NestInterceptor {
  constructor(
    private readonly activityLogsService: ActivityLogsService,
    private readonly prisma: PrismaService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (process.env.DISABLE_ACTIVITY_LOGGING === 'true') return next.handle();

    const req = context.switchToHttp().getRequest<CustomRequest>();
    const { method, originalUrl } = req;

    const isLogin = LOGIN_PATHS.includes(originalUrl);
    const isLoggable = (LOGGABLE_METHODS as readonly string[]).includes(method);

    if (
      SKIP_PATHS.some((p) => originalUrl.startsWith(p)) ||
      method === 'OPTIONS' ||
      method === 'GET' ||
      (!isLoggable && !isLogin)
    ) {
      return next.handle();
    }

    const entityType = this.extractEntityType(originalUrl);
    if (!this.isAuditable(entityType, method, isLogin)) {
      return next.handle();
    }

    const start = Date.now();
    // Old row is still needed on DELETE so the description can name the entity.
    const needsOldData =
      method === 'PUT' || method === 'PATCH' || method === 'DELETE';
    const entityId = this.extractEntityIdFromUrl(originalUrl);

    const oldData$ =
      needsOldData && entityId
        ? from(this.fetchOldEntity(entityType, entityId).catch(() => null))
        : of(null);

    return oldData$.pipe(
      switchMap((oldData) =>
        next.handle().pipe(
          tap({
            next: (responseBody: unknown) => {
              this.logActivity(
                req,
                Date.now() - start,
                'success',
                responseBody as LoggablesResponse,
                oldData,
              );
            },
            error: () => {
              this.logActivity(
                req,
                Date.now() - start,
                'error',
                undefined,
                oldData,
              );
            },
          }),
        ),
      ),
    );
  }

  /**
   * Only audit security- and business-critical entities. Logins and deletions
   * are always audited; everything else must be on the LOGGED_ENTITIES list.
   */
  private isAuditable(
    entityType: string,
    method: string,
    isLogin: boolean,
  ): boolean {
    if (isLogin) return true;
    if (ALWAYS_LOG_DELETE && method === 'DELETE') return true;
    return (LOGGED_ENTITIES as readonly string[]).includes(entityType);
  }

  private async fetchOldEntity(
    entityType: string,
    entityId: string,
  ): Promise<Record<string, unknown> | null> {
    const mapping = ENTITY_TABLE_MAP[entityType];
    if (!mapping) return null;
    const rows = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM \`${mapping.table}\` WHERE id = ? LIMIT 1`,
      entityId,
    );
    if (!Array.isArray(rows) || rows.length === 0) return null;
    const firstRow = rows[0] as Record<string, unknown>;
    return this.sanitize(firstRow);
  }

  private sanitize(
    data: Record<string, unknown> | null | undefined,
  ): Record<string, unknown> | null {
    if (!data || typeof data !== 'object') return null;
    const clean = { ...data };
    for (const key of SENSITIVE_FIELDS) {
      delete clean[key];
    }
    return clean;
  }

  private logActivity(
    req: CustomRequest,
    duration: number,
    result: string,
    responseBody?: LoggablesResponse | null,
    oldData?: Record<string, unknown> | null,
  ) {
    let actorId = req.user?.id || undefined;
    let actorType = req.user?.type || 'system';
    const entityType = this.extractEntityType(req.originalUrl);
    const isLogin = LOGIN_PATHS.includes(req.originalUrl);

    let sessionToken: string | undefined;

    if (isLogin && result === 'success') {
      const loginUser = responseBody?.data?.user || responseBody?.user;
      if (loginUser) {
        actorId = loginUser.id || undefined;
        actorType = req.originalUrl.includes('admin') ? 'admin' : 'user';
      }
      sessionToken =
        responseBody?.data?.accessToken || responseBody?.accessToken;
    }

    const action = isLogin
      ? 'login'
      : METHOD_ACTION_MAP[req.method] || req.method.toLowerCase();
    const entityId = this.extractEntityId(req.originalUrl, responseBody);
    const entityName = this.extractEntityName(
      entityType,
      oldData,
      responseBody,
      req.body,
    );
    const description = this.buildDescription(
      req,
      action,
      entityType,
      entityName,
      result,
    );

    const changes =
      action === 'update' && oldData
        ? this.buildChanges(oldData, req.body)
        : undefined;

    this.activityLogsService
      .create({
        actorId,
        actorType,
        action,
        entityType,
        entityId,
        description,
        ipAddress:
          req.ip ||
          (Array.isArray(req.headers?.['x-forwarded-for'])
            ? req.headers['x-forwarded-for'][0]
            : (req.headers?.['x-forwarded-for'] as string)) ||
          '',
        userAgent: (req.headers?.['user-agent'] as string) || '',
        metadata: {
          duration,
          result,
          statusCode: result === 'success' ? 200 : 500,
          // Only the changed fields are stored — full row snapshots bloat the table.
          ...(changes ? { changes } : {}),
          ...(sessionToken ? { sessionToken } : {}),
        },
      })
      .catch(() => {});
  }

  private buildChanges(
    oldData: Record<string, unknown> | null | undefined,
    requestBody: Record<string, unknown> | null | undefined,
  ): Array<{ field: string; from: unknown; to: unknown }> | undefined {
    if (!oldData || !requestBody || typeof requestBody !== 'object')
      return undefined;
    const changes: Array<{ field: string; from: unknown; to: unknown }> = [];

    for (const key of Object.keys(requestBody)) {
      if (SENSITIVE_FIELDS.includes(key)) continue;
      const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      const oldVal = oldData[key] ?? oldData[snakeKey];
      const newVal = requestBody[key];
      if (
        oldVal !== undefined &&
        this.safeStringify(oldVal) !== this.safeStringify(newVal)
      ) {
        changes.push({ field: key, from: oldVal, to: newVal });
      }
    }
    return changes.length > 0 ? changes : undefined;
  }

  private extractEntityName(
    entityType: string,
    oldData: Record<string, unknown> | null | undefined,
    responseBody: LoggablesResponse | null | undefined,
    reqBody: Record<string, unknown> | null | undefined,
  ): string {
    const mapping = ENTITY_TABLE_MAP[entityType];
    if (!mapping?.nameCol) return '';
    const col = mapping.nameCol.replace(/`/g, '');
    const val =
      oldData?.[col] ??
      responseBody?.data?.[col] ??
      responseBody?.[col] ??
      reqBody?.[col] ??
      '';
    return this.safeStringify(val);
  }

  private buildDescription(
    req: CustomRequest,
    action: string,
    entityType: string,
    entityName: string,
    result: string,
  ): string {
    if (action === 'login') {
      const email = (req.body?.email as string) || 'unknown';
      const type = req.originalUrl.includes('admin') ? 'Admin' : 'User';
      return result === 'success'
        ? `${type} login successful for ${email}`
        : `${type} login failed for ${email}`;
    }

    const actionLabel = action.charAt(0).toUpperCase() + action.slice(1);
    const typeLabel = entityType.replace(/_/g, ' ');
    const nameLabel = entityName ? ` "${entityName}"` : '';
    return `${actionLabel} ${typeLabel}${nameLabel} - ${result}`;
  }

  private extractEntityType(url: string): string {
    const segments = url.replace('/api/', '').split('/');
    return PATH_SEGMENT_TO_ENTITY[segments[0]] || 'other';
  }

  private extractEntityIdFromUrl(url: string): string | undefined {
    const segments = url.replace('/api/', '').split('/');
    const lastSegment = segments[segments.length - 1];
    // UUID format check: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(lastSegment) ? lastSegment : undefined;
  }

  private extractEntityId(
    url: string,
    responseBody?: LoggablesResponse | null,
  ): string | undefined {
    const fromUrl = this.extractEntityIdFromUrl(url);
    if (fromUrl) return fromUrl;
    const data = responseBody?.data || responseBody;
    return data?.id ? String(data.id) : undefined;
  }

  private safeStringify(val: unknown): string {
    if (val === null || val === undefined) return '';
    if (typeof val === 'object') {
      try {
        return JSON.stringify(val);
      } catch {
        return '[Object]';
      }
    }
    if (
      typeof val === 'string' ||
      typeof val === 'number' ||
      typeof val === 'boolean' ||
      typeof val === 'symbol' ||
      typeof val === 'bigint'
    ) {
      return String(val);
    }
    return '';
  }
}
