import { Prisma } from '@prisma/client';

const SOFT_DELETE_MODELS = [
  'User',
  'UserAddress',
  'Admin',
  'Category',
  'Product',
  'Order',
  'ProductReview',
  'Media',
  'EmailTemplate',
  'FAQ',
  'Contact',
  'Blog',
];
const SOFT_DELETE_RELATIONS = [
  'addresses',
  'orders',
  'products',
  'children',
  'parent',
  'reviews',
  'replies',
];

/** Join tables without their own deletedAt column - soft-delete is derived from the linked Media row. */
const MEDIA_JOIN_RELATIONS = ['productMedia'];

interface ExtendedModelContext {
  update(args: {
    where: Record<string, unknown>;
    data: Record<string, unknown>;
  }): Promise<unknown>;
  updateMany(args: {
    where: Record<string, unknown>;
    data: Record<string, unknown>;
  }): Promise<unknown>;
}

function injectSoftDeleteFilter(args: unknown) {
  if (!args || typeof args !== 'object') return;
  const anyArgs = args as Record<string, unknown>;

  if (anyArgs.include && typeof anyArgs.include === 'object') {
    const include = anyArgs.include as Record<string, unknown>;
    for (const key of Object.keys(include)) {
      const val = include[key];
      if (val === true) {
        if (MEDIA_JOIN_RELATIONS.includes(key)) {
          include[key] = { where: { media: { deletedAt: null } } };
        } else if (SOFT_DELETE_RELATIONS.includes(key)) {
          include[key] = { where: { deletedAt: null } };
        }
      } else if (val && typeof val === 'object') {
        const objVal = val as Record<string, unknown>;
        if (MEDIA_JOIN_RELATIONS.includes(key)) {
          const where = (objVal.where || {}) as Record<string, unknown>;
          if (!where.media) {
            where.media = { deletedAt: null };
          }
          objVal.where = where;
        } else if (SOFT_DELETE_RELATIONS.includes(key)) {
          const where = (objVal.where || {}) as Record<string, unknown>;
          objVal.where = where;
          if (where.deletedAt === undefined) {
            where.deletedAt = null;
          }
        }
        injectSoftDeleteFilter(val);
      }
    }
  }

  if (anyArgs.select && typeof anyArgs.select === 'object') {
    const select = anyArgs.select as Record<string, unknown>;
    for (const key of Object.keys(select)) {
      const val = select[key];
      if (val && typeof val === 'object') {
        const objVal = val as Record<string, unknown>;
        if (SOFT_DELETE_RELATIONS.includes(key)) {
          const where = (objVal.where || {}) as Record<string, unknown>;
          objVal.where = where;
          if (where.deletedAt === undefined) {
            where.deletedAt = null;
          }
        }
        injectSoftDeleteFilter(val);
      }
    }
  }
}

export const softDeleteExtension = Prisma.defineExtension((client) => {
  return client.$extends({
    name: 'soft-delete',
    model: {
      $allModels: {
        async softDelete<T>(this: T, id: string) {
          const context = Prisma.getExtensionContext(
            this,
          ) as unknown as ExtendedModelContext;
          return await context.update({
            where: { id },
            data: { deletedAt: new Date() },
          });
        },
        async restore<T>(this: T, id: string) {
          const context = Prisma.getExtensionContext(
            this,
          ) as unknown as ExtendedModelContext;
          return await context.update({
            where: { id },
            data: { deletedAt: null },
          });
        },
      },
    },
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const anyArgs = args as Record<string, unknown>;

          // 1. Intercept read operations
          const readOperations = [
            'findMany',
            'findFirst',
            'findFirstOrThrow',
            'count',
            'aggregate',
            'groupBy',
          ];
          if (SOFT_DELETE_MODELS.includes(model)) {
            if (readOperations.includes(operation)) {
              const where = (anyArgs.where || {}) as Record<string, unknown>;
              anyArgs.where = where;
              if (where.deletedAt === undefined) {
                where.deletedAt = null;
              }
            }
          }

          // 2. Recursively filter relations in includes/selects
          injectSoftDeleteFilter(anyArgs);

          // 3. Intercept findUnique and findUniqueOrThrow
          if (SOFT_DELETE_MODELS.includes(model)) {
            if (operation === 'findUnique') {
              const select = anyArgs.select as Record<string, unknown> | undefined;
              const hadDeletedAt = select?.deletedAt === true;
              if (select && !hadDeletedAt) {
                select.deletedAt = true;
              }
              const result = await query(args);
              const resultObj = result as Record<string, unknown> | null;
              if (
                resultObj &&
                resultObj.deletedAt !== null &&
                resultObj.deletedAt !== undefined
              ) {
                return null;
              }
              if (resultObj && select && !hadDeletedAt) {
                delete resultObj.deletedAt;
              }
              return result;
            }

            if (operation === 'findUniqueOrThrow') {
              const select = anyArgs.select as Record<string, unknown> | undefined;
              const hadDeletedAt = select?.deletedAt === true;
              if (select && !hadDeletedAt) {
                select.deletedAt = true;
              }
              const result = await query(args);
              const resultObj = result as Record<string, unknown> | null;
              if (
                resultObj &&
                resultObj.deletedAt !== null &&
                resultObj.deletedAt !== undefined
              ) {
                throw new Prisma.PrismaClientKnownRequestError(
                  'An operation failed because it depends on one or more records that were required but not found.',
                  {
                    code: 'P2025',
                    clientVersion: Prisma.prismaVersion.client,
                  },
                );
              }
              if (resultObj && select && !hadDeletedAt) {
                delete resultObj.deletedAt;
              }
              return result;
            }

            // 4. Intercept delete and deleteMany to soft-delete
            if (operation === 'delete') {
              const modelContext = Prisma.getExtensionContext(
                this,
              ) as unknown as ExtendedModelContext;
              return modelContext.update({
                where: anyArgs.where as Record<string, unknown>,
                data: { deletedAt: new Date() },
              });
            }

            if (operation === 'deleteMany') {
              const modelContext = Prisma.getExtensionContext(
                this,
              ) as unknown as ExtendedModelContext;
              return modelContext.updateMany({
                where: anyArgs.where as Record<string, unknown>,
                data: { deletedAt: new Date() },
              });
            }
          }

          return query(args);
        },
      },
    },
  });
});
