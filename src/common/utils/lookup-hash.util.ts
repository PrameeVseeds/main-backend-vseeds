import { createHash } from 'crypto';

export type LookupFieldKind = 'email' | 'username' | 'promo_code';

function normalizeForLookup(value: string, kind: LookupFieldKind): string {
  const trimmed = value.trim();
  switch (kind) {
    case 'email':
      return trimmed.toLowerCase();
    case 'username':
      return trimmed.toLowerCase();
    case 'promo_code':
      return trimmed.toUpperCase();
    default:
      return trimmed;
  }
}

/** Deterministic SHA-256 lookup key for encrypted unique/search fields. */
export function createLookupHash(
  value: string,
  kind: LookupFieldKind,
): string {
  if (!value) {
    throw new Error(`Cannot create lookup hash for empty ${kind}`);
  }
  const normalized = normalizeForLookup(value, kind);
  return createHash('sha256').update(normalized, 'utf8').digest('hex');
}

export function isLikelyEmail(query: string): boolean {
  return query.includes('@');
}
