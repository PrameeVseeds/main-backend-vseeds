import { Prisma, PrismaClient } from '@prisma/client';

const HISTORY_CLIENT_MAP: Record<
  string,
  { historyDelegate: string; sourceIdField: string }
> = {
  User: { historyDelegate: 'userHistory', sourceIdField: 'userId' },
  Admin: { historyDelegate: 'adminHistory', sourceIdField: 'adminId' },
  PromoCode: {
    historyDelegate: 'promoCodeHistory',
    sourceIdField: 'promoCodeId',
  },
  Contact: { historyDelegate: 'contactHistory', sourceIdField: 'contactId' },
};

const SENSITIVE_FIELDS = new Set([
  'passwordHash',
  'twoFactorSecret',
  'refreshToken',
]);

function sanitizeSnapshot(record: Record<string, unknown>) {
  const copy: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (SENSITIVE_FIELDS.has(key)) continue;
    copy[key] = value;
  }
  return copy;
}

function getRecordId(record: Record<string, unknown>): string | null {
  const id = record.id;
  return typeof id === 'string' ? id : null;
}

async function writeHistory(
  baseClient: PrismaClient,
  model: string,
  action: string,
  record: Record<string, unknown>,
  changedBy?: string | null,
) {
  const config = HISTORY_CLIENT_MAP[model];
  if (!config) return;

  const recordId = getRecordId(record);
  if (!recordId) return;

  const delegate = (baseClient as Record<string, any>)[config.historyDelegate];
  if (!delegate?.create) return;

  await delegate.create({
    data: {
      [config.sourceIdField]: recordId,
      action,
      snapshot: sanitizeSnapshot(record),
      changedBy: changedBy ?? null,
    },
  });
}

function extractIdFromWhere(where: unknown): string | null {
  if (!where || typeof where !== 'object') return null;
  const id = (where as Record<string, unknown>).id;
  return typeof id === 'string' ? id : null;
}

export const historyExtension = (baseClient: PrismaClient) => {
  return Prisma.defineExtension({
    name: 'history',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const config = HISTORY_CLIENT_MAP[model];
          let previous: Record<string, unknown> | null = null;

          if (
            config &&
            (operation === 'update' ||
              operation === 'delete' ||
              operation === 'upsert')
          ) {
            const recordId = extractIdFromWhere(
              (args as { where?: unknown })?.where,
            );
            if (recordId) {
              const camel = model.charAt(0).toLowerCase() + model.slice(1);
              const modelDelegate = (baseClient as Record<string, any>)[camel];
              if (modelDelegate?.findUnique) {
                previous = await modelDelegate.findUnique({
                  where: { id: recordId },
                });
              }
            }
          }

          const result = await query(args);

          if (!config) {
            return result;
          }

          if (operation === 'create' && result && typeof result === 'object') {
            await writeHistory(
              baseClient,
              model,
              'INSERT',
              result as Record<string, unknown>,
            );
          } else if (
            operation === 'update' &&
            result &&
            typeof result === 'object'
          ) {
            await writeHistory(
              baseClient,
              model,
              'UPDATE',
              result as Record<string, unknown>,
            );
          } else if (operation === 'delete' && previous) {
            await writeHistory(baseClient, model, 'DELETE', previous);
          } else if (
            operation === 'upsert' &&
            result &&
            typeof result === 'object'
          ) {
            await writeHistory(
              baseClient,
              model,
              previous ? 'UPDATE' : 'INSERT',
              result as Record<string, unknown>,
            );
          }

          return result;
        },
      },
    },
  });
};
