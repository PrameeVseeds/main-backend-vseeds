import { Prisma } from '@prisma/client';
import { EncryptionService } from '../common/services/encryption.service';
import {
  createLookupHash,
  LookupFieldKind,
} from '../common/utils/lookup-hash.util';

const ENCRYPT_FIELDS_MAP: Record<string, string[]> = {
  User: ['email'],
  Admin: ['username', 'email'],
  PromoCode: ['code'],
  Contact: ['email'],
  UserAddress: [
    'fullName',
    'email',
    'phone',
    'addressLine1',
    'addressLine2',
    'city',
    'district',
    'province',
    'postalCode',
  ],
  Bank: ['bankName', 'branch', 'accountNumber', 'accountName'],
  Payment: ['referenceNumber'],
};

const LOOKUP_FIELD_MAP: Record<string, Record<string, LookupFieldKind>> = {
  User: { email: 'email' },
  Admin: { username: 'username', email: 'email' },
  PromoCode: { code: 'promo_code' },
};

const LOOKUP_COLUMN_MAP: Record<string, Record<string, string>> = {
  User: { email: 'emailLookup' },
  Admin: { username: 'usernameLookup', email: 'emailLookup' },
  PromoCode: { code: 'codeLookup' },
};

const RELATION_MODEL_MAP: Record<string, string> = {
  addresses: 'UserAddress',
  payments: 'Payment',
  bank: 'Bank',
};

function applyLookupHashes(modelName: string, dataObj: Record<string, unknown>) {
  const lookupColumns = LOOKUP_COLUMN_MAP[modelName];
  if (!lookupColumns) return;

  for (const [sourceField, lookupField] of Object.entries(lookupColumns)) {
    const raw = dataObj[sourceField];
    if (typeof raw === 'string' && raw && !raw.startsWith('ENC:')) {
      const kind = LOOKUP_FIELD_MAP[modelName]?.[sourceField];
      if (kind) {
        dataObj[lookupField] = createLookupHash(raw, kind);
      }
    }
  }
}

function encryptPayload(
  modelName: string,
  data: unknown,
  encryptionService: EncryptionService,
): void {
  if (!data || typeof data !== 'object') return;

  if (Array.isArray(data)) {
    data.forEach((item: unknown) =>
      encryptPayload(modelName, item, encryptionService),
    );
    return;
  }

  const dataObj = data as Record<string, unknown>;
  applyLookupHashes(modelName, dataObj);

  const fieldsToEncrypt = ENCRYPT_FIELDS_MAP[modelName];
  if (fieldsToEncrypt) {
    for (const field of fieldsToEncrypt) {
      const val = dataObj[field];
      if (
        typeof val === 'string' &&
        val &&
        !encryptionService.isEncrypted(val)
      ) {
        dataObj[field] = encryptionService.encrypt(val);
      }
    }
  }

  for (const key of Object.keys(dataObj)) {
    const value = dataObj[key];
    if (value && typeof value === 'object') {
      const nestedModel = RELATION_MODEL_MAP[key];
      if (nestedModel) {
        const valueObj = value as Record<string, unknown>;
        if (valueObj.create) {
          encryptPayload(nestedModel, valueObj.create, encryptionService);
        }
        if (valueObj.update) {
          const updateVal = valueObj.update;
          if (Array.isArray(updateVal)) {
            updateVal.forEach((u: unknown) => {
              if (u && typeof u === 'object') {
                const uObj = u as Record<string, unknown>;
                if (uObj.data) {
                  encryptPayload(nestedModel, uObj.data, encryptionService);
                }
              }
            });
          } else if (updateVal && typeof updateVal === 'object') {
            const updateObj = updateVal as Record<string, unknown>;
            encryptPayload(
              nestedModel,
              updateObj.data || updateObj,
              encryptionService,
            );
          }
        }
        if (valueObj.upsert) {
          const upsertVal = valueObj.upsert;
          if (upsertVal && typeof upsertVal === 'object') {
            const upsertObj = upsertVal as Record<string, unknown>;
            if (upsertObj.create) {
              encryptPayload(nestedModel, upsertObj.create, encryptionService);
            }
            if (upsertObj.update) {
              encryptPayload(nestedModel, upsertObj.update, encryptionService);
            }
          }
        }
      }
    }
  }
}

function decryptPayload(
  data: unknown,
  encryptionService: EncryptionService,
): unknown {
  if (!data) return data;

  if (Array.isArray(data)) {
    return data.map((item: unknown) => decryptPayload(item, encryptionService));
  }

  if (typeof data === 'object') {
    const dataObj = data as Record<string, unknown>;
    for (const key of Object.keys(dataObj)) {
      const value = dataObj[key];
      if (typeof value === 'string' && encryptionService.isEncrypted(value)) {
        try {
          dataObj[key] = encryptionService.decrypt(value);
        } catch {
          // Keep encrypted value on decryption failure
        }
      } else if (value && typeof value === 'object') {
        dataObj[key] = decryptPayload(value, encryptionService);
      }
    }
  }

  return data;
}

export const encryptionExtension = (encryptionService: EncryptionService) => {
  return Prisma.defineExtension({
    name: 'encryption',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const writeOperations = [
            'create',
            'createMany',
            'update',
            'updateMany',
            'upsert',
          ];
          const anyArgs = args as Record<string, unknown> | undefined;

          if (anyArgs && writeOperations.includes(operation)) {
            if (operation === 'upsert') {
              if (anyArgs.create) {
                encryptPayload(model, anyArgs.create, encryptionService);
              }
              if (anyArgs.update) {
                encryptPayload(model, anyArgs.update, encryptionService);
              }
            } else if (anyArgs.data) {
              encryptPayload(model, anyArgs.data, encryptionService);
            }
          }

          const result = await query(args);

          return decryptPayload(result, encryptionService);
        },
      },
    },
  });
};
