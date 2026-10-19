/* eslint-disable */
/**
 * Selective Data Migration: old_db.sql → New System
 *
 * Reads the SQL dump file and imports ONLY essential business data:
 *
 *   IMPORTED (core business entities):
 *     categories        – product organisation
 *     products_list     – product catalogue  → products + product_price_tiers
 *     image_details     – media files        → media  (only those linked to products)
 *     product_image     – product↔media      → product_media
 *     product_reviews   – customer reviews
 *     users + user_details – customer accounts (only those with orders, or active)
 *     user_address      – shipping addresses
 *     orders            – order history
 *     order_items       – line items
 *     order_comments    – shipping address link + notes
 *     payments          – financial records
 *     shipment          – delivery tracking
 *
 *   SKIPPED (not needed / recreated in new system):
 *     admins            – fresh accounts via seed.ts
 *     roles             – new RBAC managed by seed.ts
 *     privileges        – new RBAC managed by seed.ts
 *     role_privileges   – new RBAC managed by seed.ts
 *     activity_logs     – old audit trail, new system generates its own
 *     banners           – marketing content, easily recreated in admin
 *     contacts          – old support messages
 *     contact_replay    – old support replies
 *     wishlists         – stale user preferences
 *     email_templates   – empty table, new system has its own
 *     history           – empty table
 *     migrations        – internal framework tracking
 *     payment_methods   – config data ("Bank"/"Other")
 *     projects          – portfolio items, can be recreated
 *     quotes            – empty table
 *     resetpassword     – temporary tokens
 */

import * as mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID, createHash } from 'crypto';

dotenv.config();

// ────────────────────────────────────────────────────────────────────────────
// Configuration
// ────────────────────────────────────────────────────────────────────────────

const DRY_RUN = process.argv.includes('--dry-run');
const BATCH_SIZE = 100;

const SQL_DUMP_PATH =
  process.argv.find((a) => a.startsWith('--file='))?.split('=')[1] ||
  path.resolve(__dirname, '..', '..', 'old DB', 'old_db.sql');

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
};

const NEW_DB = process.env.DATABASE;
if (!NEW_DB) {
  console.error('Missing DATABASE in .env');
  process.exit(1);
}

// ────────────────────────────────────────────────────────────────────────────
// SQL Dump Parser
// ────────────────────────────────────────────────────────────────────────────

function parseSqlDump(filePath: string): Map<string, Record<string, any>[]> {
  log('Reading SQL dump: ' + filePath);
  if (!fs.existsSync(filePath)) {
    logErr('SQL dump file not found: ' + filePath);
    process.exit(1);
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const tableData = new Map<string, Record<string, any>[]>();
  const insertRegex = /INSERT INTO `([^`]+)`\s*\(([^)]+)\)\s*VALUES\s*/g;
  let match: RegExpExecArray | null;

  while ((match = insertRegex.exec(content)) !== null) {
    const tableName = match[1];
    const columns = match[2].split(',').map((c) => c.trim().replace(/`/g, ''));
    const rows = parseValuesTuples(
      content,
      match.index + match[0].length,
      columns,
    );
    if (!tableData.has(tableName)) tableData.set(tableName, []);
    tableData.get(tableName)!.push(...rows);
  }

  for (const [table, rows] of tableData)
    log(`  Parsed ${table}: ${rows.length} rows`);
  return tableData;
}

function parseValuesTuples(
  sql: string,
  startIdx: number,
  columns: string[],
): Record<string, any>[] {
  const rows: Record<string, any>[] = [];
  let i = startIdx;
  const len = sql.length;

  while (i < len) {
    while (
      i < len &&
      (sql[i] === ' ' || sql[i] === '\n' || sql[i] === '\r' || sql[i] === ',')
    )
      i++;
    if (i >= len || sql[i] === ';') break;
    if (sql[i] !== '(') break;

    i++;
    const values: any[] = [];
    let currentVal = '';
    let inString = false;
    let escaped = false;

    while (i < len) {
      const ch = sql[i];

      if (escaped) {
        if (ch === "'") currentVal += "'";
        else if (ch === '\\') currentVal += '\\';
        else if (ch === 'n') currentVal += '\n';
        else if (ch === 'r') currentVal += '\r';
        else if (ch === 't') currentVal += '\t';
        else if (ch === '0') currentVal += '\0';
        else currentVal += ch;
        escaped = false;
        i++;
        continue;
      }

      if (inString) {
        if (ch === '\\') {
          escaped = true;
          i++;
          continue;
        }
        if (ch === "'") {
          if (i + 1 < len && sql[i + 1] === "'") {
            currentVal += "'";
            i += 2;
            continue;
          }
          inString = false;
          i++;
          continue;
        }
        currentVal += ch;
        i++;
        continue;
      }

      if (ch === "'") {
        inString = true;
        currentVal = '';
        i++;
        continue;
      }

      if (ch === ',' || ch === ')') {
        const trimmed = currentVal.trim();
        if (trimmed.toUpperCase() === 'NULL' || trimmed === '')
          values.push(null);
        else {
          const num = Number(trimmed);
          values.push(trimmed.length > 0 && !isNaN(num) ? num : trimmed);
        }
        currentVal = '';
        if (ch === ')') {
          i++;
          break;
        }
        i++;
        continue;
      }

      currentVal += ch;
      i++;
    }

    if (values.length === columns.length) {
      const row: Record<string, any> = {};
      for (let c = 0; c < columns.length; c++) row[columns[c]] = values[c];
      rows.push(row);
    }
  }

  return rows;
}

// ────────────────────────────────────────────────────────────────────────────
// ID Mapping + Stats
// ────────────────────────────────────────────────────────────────────────────

const idMap = new Map<string, Map<number, string>>();

function mapId(table: string, oldId: number): string {
  if (!idMap.has(table)) idMap.set(table, new Map());
  const tbl = idMap.get(table)!;
  if (!tbl.has(oldId)) tbl.set(oldId, randomUUID());
  return tbl.get(oldId)!;
}

function resolveId(
  table: string,
  oldId: number | null | undefined,
): string | null {
  if (oldId == null) return null;
  return idMap.get(table)?.get(oldId) ?? null;
}

interface TableStats {
  imported: number;
  skipped: number;
  errors: number;
  skipReasons: Map<string, number>;
}
const stats = new Map<string, TableStats>();

function getStat(t: string): TableStats {
  if (!stats.has(t))
    stats.set(t, {
      imported: 0,
      skipped: 0,
      errors: 0,
      skipReasons: new Map(),
    });
  return stats.get(t)!;
}

function skip(entity: string, reason: string) {
  const s = getStat(entity);
  s.skipped++;
  s.skipReasons.set(reason, (s.skipReasons.get(reason) || 0) + 1);
}

function log(msg: string) {
  console.log(`[MIGRATE] ${msg}`);
}
function logWarn(msg: string) {
  console.warn(`[MIGRATE:WARN] ${msg}`);
}
function logErr(msg: string) {
  console.error(`[MIGRATE:ERR] ${msg}`);
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function safeDate(d: any): string | null {
  if (!d) return null;
  const s = String(d);
  if (s.startsWith('0000') || s === 'Invalid Date') return null;
  const date = new Date(d);
  return isNaN(date.getTime())
    ? null
    : date.toISOString().slice(0, 19).replace('T', ' ');
}

function nowStr(): string {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

function isEncrypted(value: any): boolean {
  if (value == null) return false;
  const s = String(value).trim();
  return s.length > 0 && /^([0-9a-fA-F]{2}:){5,}[0-9a-fA-F]{2}$/.test(s);
}

function pad(n: number, width: number): string {
  return String(n).padStart(width, '0');
}

/** Same hash as src/common/utils/lookup-hash.util.ts (email kind). */
function emailLookupHash(email: string): string {
  return createHash('sha256')
    .update(email.trim().toLowerCase(), 'utf8')
    .digest('hex');
}

function extractFilename(url: string): string {
  try {
    return url.split('/').pop() || 'unknown';
  } catch {
    return 'unknown';
  }
}

function guessMimeType(url: string): string {
  const l = url.toLowerCase();
  if (l.endsWith('.png')) return 'image/png';
  if (l.endsWith('.jpg') || l.endsWith('.jpeg')) return 'image/jpeg';
  if (l.endsWith('.gif')) return 'image/gif';
  if (l.endsWith('.webp')) return 'image/webp';
  if (l.endsWith('.svg')) return 'image/svg+xml';
  return 'image/jpeg';
}

function mapOrderStatus(old: string): string {
  const s = (old || 'pending').toLowerCase().trim();
  const map: Record<string, string> = {
    'waiting for payment': 'waiting_for_payment',
    pending: 'pending',
    processing: 'processing',
    shipped: 'shipped',
    delivered: 'delivered',
    cancelled: 'cancelled',
  };
  return map[s] || 'pending';
}

function mapPaymentStatus(old: string): string {
  const s = (old || 'pending').toLowerCase().trim();
  if (s === 'completed') return 'completed';
  if (s === 'cancelled') return 'failed';
  return 'pending';
}

function tryParseJson(val: any): any {
  if (val == null) return null;
  if (typeof val === 'object') return val;
  try {
    return JSON.parse(String(val));
  } catch {
    return val;
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Batch Insert
// ────────────────────────────────────────────────────────────────────────────

async function batchInsert(
  conn: mysql.Connection,
  table: string,
  columns: string[],
  rows: any[][],
  entity: string,
): Promise<void> {
  if (rows.length === 0) return;

  const ph = `(${columns.map(() => '?').join(',')})`;
  const colList = columns.map((c) => `\`${c}\``).join(',');

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const sql = `INSERT INTO \`${NEW_DB}\`.\`${table}\` (${colList}) VALUES ${batch.map(() => ph).join(',')}`;
    const flat = batch.flat();

    if (DRY_RUN) {
      getStat(entity).imported += batch.length;
    } else {
      try {
        await conn.query(sql, flat);
        getStat(entity).imported += batch.length;
      } catch (err: any) {
        if (err.code === 'ER_DUP_ENTRY') {
          for (const row of batch) {
            try {
              await conn.query(
                `INSERT INTO \`${NEW_DB}\`.\`${table}\` (${colList}) VALUES ${ph}`,
                row,
              );
              getStat(entity).imported++;
            } catch (singleErr: any) {
              if (singleErr.code === 'ER_DUP_ENTRY') skip(entity, 'duplicate');
              else {
                getStat(entity).errors++;
                logErr(`${entity} insert: ${singleErr.message}`);
              }
            }
          }
        } else {
          getStat(entity).errors += batch.length;
          logErr(`${entity} batch: ${err.message}`);
        }
      }
    }
  }
}

function getRows(
  dump: Map<string, Record<string, any>[]>,
  table: string,
): Record<string, any>[] {
  return dump.get(table) || [];
}

// ────────────────────────────────────────────────────────────────────────────
// Pre-Analysis: determine which records are essential
// ────────────────────────────────────────────────────────────────────────────

interface ImportPlan {
  userIdsToImport: Set<number>;
  productIdsToImport: Set<number>;
  categoryIdsToImport: Set<number>;
  mediaIdsToImport: Set<number>;
  addressIdsToImport: Set<number>;
}

function buildImportPlan(dump: Map<string, Record<string, any>[]>): ImportPlan {
  log('\n── Building selective import plan ──');

  const orders = getRows(dump, 'orders');
  const orderItems = getRows(dump, 'order_items');
  const orderComments = getRows(dump, 'order_comments');
  const products = getRows(dump, 'products_list');
  const users = getRows(dump, 'users');
  const productImages = getRows(dump, 'product_image').filter(
    (r) => r.deleted_at == null,
  );

  // 1. Users referenced by orders (must import regardless of status)
  const userIdsWithOrders = new Set<number>(orders.map((o) => o.user_id));
  // Also import active users (potential returning customers)
  const activeUserIds = new Set<number>(
    users.filter((u) => u.status == 1 && u.deleted_at == null).map((u) => u.id),
  );
  const userIdsToImport = new Set<number>([
    ...userIdsWithOrders,
    ...activeUserIds,
  ]);

  const skippedUsers = users.filter((u) => !userIdsToImport.has(u.id));
  log(
    `  Users: ${userIdsToImport.size} to import, ${skippedUsers.length} skipped (deleted + no orders)`,
  );

  // 2. Products referenced by order items (must import for FK integrity)
  const productIdsInOrders = new Set<number>(
    orderItems.map((oi) => oi.product_id),
  );
  // Also import active products
  const activeProductIds = new Set<number>(
    products
      .filter((p) => p.status == 1 && p.deleted_at == null)
      .map((p) => p.id),
  );
  const productIdsToImport = new Set<number>([
    ...productIdsInOrders,
    ...activeProductIds,
  ]);

  const skippedProducts = products.filter((p) => !productIdsToImport.has(p.id));
  log(
    `  Products: ${productIdsToImport.size} to import, ${skippedProducts.length} skipped (deleted + unreferenced)`,
  );

  // 3. Categories referenced by imported products
  const categoryIdsToImport = new Set<number>();
  for (const p of products) {
    if (productIdsToImport.has(p.id) && p.category_id != null) {
      categoryIdsToImport.add(p.category_id);
    }
  }

  const allCategories = getRows(dump, 'categories');
  log(
    `  Categories: ${categoryIdsToImport.size} to import, ${allCategories.length - categoryIdsToImport.size} skipped (no products)`,
  );

  // 4. Media linked to imported products (skip orphan media)
  const mediaIdsToImport = new Set<number>();
  for (const pi of productImages) {
    if (productIdsToImport.has(pi.product_id)) {
      mediaIdsToImport.add(pi.image_id);
    }
  }

  const allMedia = getRows(dump, 'image_details');
  log(
    `  Media: ${mediaIdsToImport.size} to import, ${allMedia.length - mediaIdsToImport.size} skipped (orphan / unlinked)`,
  );

  // 5. Addresses referenced by order_comments or belonging to imported users
  const addressIdsInOrders = new Set<number>(
    orderComments.filter((c) => c.address_id != null).map((c) => c.address_id),
  );
  const allAddresses = getRows(dump, 'user_address');
  const addressIdsToImport = new Set<number>();
  for (const a of allAddresses) {
    if (addressIdsInOrders.has(a.id) || userIdsToImport.has(a.user_id)) {
      addressIdsToImport.add(a.id);
    }
  }
  log(
    `  Addresses: ${addressIdsToImport.size} to import, ${allAddresses.length - addressIdsToImport.size} skipped`,
  );

  log('');
  return {
    userIdsToImport,
    productIdsToImport,
    categoryIdsToImport,
    mediaIdsToImport,
    addressIdsToImport,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Migration Functions (selective)
// ────────────────────────────────────────────────────────────────────────────

async function migrateCategories(
  dump: Map<string, Record<string, any>[]>,
  conn: mysql.Connection,
  plan: ImportPlan,
) {
  log('Migrating categories...');
  const rows = getRows(dump, 'categories');
  const usedSlugs = new Set<string>();
  const columns = [
    'id',
    'parent_id',
    'name',
    'slug',
    'icon',
    'description',
    'display_order',
    'status',
    'created_at',
    'updated_at',
    'deleted_at',
  ];
  const data: any[][] = [];

  for (const r of rows) {
    if (!plan.categoryIdsToImport.has(r.id)) {
      skip('categories', 'no products reference this category');
      continue;
    }

    const uuid = mapId('categories', r.id);
    let slug = slugify(r.name);
    let counter = 2;
    const base = slug;
    while (usedSlugs.has(slug)) slug = `${base}-${counter++}`;
    usedSlugs.add(slug);

    const statusVal = r.status == 1 ? 'active' : 'inactive';
    data.push([
      uuid,
      null,
      r.name,
      slug,
      null,
      null,
      0,
      statusVal,
      safeDate(r.created_at) || nowStr(),
      nowStr(),
      safeDate(r.deleted_at),
    ]);
  }

  await batchInsert(conn, 'categories', columns, data, 'categories');
}

async function migrateProducts(
  dump: Map<string, Record<string, any>[]>,
  conn: mysql.Connection,
  plan: ImportPlan,
) {
  log('Migrating products...');
  const rows = getRows(dump, 'products_list');
  const usedSlugs = new Set<string>();

  const prodColumns = [
    'id',
    'category_id',
    'sku',
    'name',
    'slug',
    'description',
    'specifications',
    'tags',
    'datasheet_url',
    'model_3d_url',
    'product_link',
    'sub_category',
    'store_id',
    'quantity_in_hand',
    'quantity_ordered',
    'purchased_price',
    'expected_date',
    'status',
    'is_featured',
    'created_at',
    'updated_at',
    'deleted_at',
  ];
  const tierColumns = ['id', 'product_id', 'min_quantity', 'price'];

  const prodData: any[][] = [];
  const tierData: any[][] = [];
  const usedSkus = new Set<string>();

  for (const r of rows) {
    if (!plan.productIdsToImport.has(r.id)) {
      skip('products', 'deleted + unreferenced by orders');
      continue;
    }

    const uuid = mapId('products', r.id);
    const catUuid = resolveId('categories', r.category_id);

    // sku is unique — dedupe so a shared store_id/unique_id can't fail the insert
    let sku: string | null = r.unique_id
      ? String(r.unique_id)
      : r.store_id
        ? String(r.store_id)
        : null;
    if (sku && usedSkus.has(sku)) sku = null;
    if (sku) usedSkus.add(sku);

    let baseSlug = r.unique_id
      ? slugify(String(r.unique_id))
      : slugify(String(r.name));
    if (!baseSlug) baseSlug = `product-${r.id}`;
    let slug = baseSlug;
    let counter = 2;
    while (usedSlugs.has(slug)) slug = `${baseSlug}-${counter++}`;
    usedSlugs.add(slug);

    let specs: any = null;
    if (r.specifications != null) {
      const raw = tryParseJson(r.specifications);
      specs =
        typeof raw === 'string' ? JSON.stringify([raw]) : JSON.stringify(raw);
    }

    let tags: any = null;
    if (r.tags != null) {
      const raw = tryParseJson(r.tags);
      tags = Array.isArray(raw) ? JSON.stringify(raw) : JSON.stringify([raw]);
    }

    const statusEnum = r.deleted_at
      ? 'inactive'
      : r.status == 1
        ? 'active'
        : 'inactive';

    prodData.push([
      uuid,
      catUuid,
      sku,
      r.name,
      slug,
      r.description || null,
      specs,
      tags,
      r.data_sheet_link || r.link || null,
      null,
      r.product_link || null,
      r.sub_category || null,
      r.store_id || null,
      r.quantity || 0,
      r.ordered_count || 0,
      r.purchased_price || null,
      r.expected_date || null,
      statusEnum,
      r.to_page == 1 ? 1 : 0,
      safeDate(r.created_at) || nowStr(),
      nowStr(),
      safeDate(r.deleted_at),
    ]);

    let priceOptions: string[] = [];
    try {
      const parsed = tryParseJson(r.price_options);
      if (Array.isArray(parsed)) priceOptions = parsed;
    } catch {
      /* skip */
    }

    const minQtys = [1, 10, 100];
    for (let idx = 0; idx < priceOptions.length && idx < 3; idx++) {
      const price = parseFloat(priceOptions[idx]);
      if (!isNaN(price) && price > 0) {
        tierData.push([randomUUID(), uuid, minQtys[idx], price]);
      }
    }
  }

  await batchInsert(conn, 'products', prodColumns, prodData, 'products');
  await batchInsert(
    conn,
    'product_price_tiers',
    tierColumns,
    tierData,
    'product_price_tiers',
  );
}

async function migrateMedia(
  dump: Map<string, Record<string, any>[]>,
  conn: mysql.Connection,
  plan: ImportPlan,
) {
  log('Migrating media (only product-linked)...');
  const rows = getRows(dump, 'image_details');
  const columns = [
    'id',
    'filename',
    'original_name',
    'mime_type',
    'file_size',
    'url',
    'alt_text',
    'created_at',
    'deleted_at',
  ];
  const data: any[][] = [];

  for (const r of rows) {
    if (!plan.mediaIdsToImport.has(r.id)) {
      skip('media', 'orphan media not linked to any product');
      continue;
    }

    const uuid = mapId('media', r.id);
    const filename = extractFilename(r.url);
    data.push([
      uuid,
      filename,
      filename,
      guessMimeType(r.url),
      null,
      r.url,
      null,
      safeDate(r.created_at) || nowStr(),
      safeDate(r.deleted_at),
    ]);
  }

  await batchInsert(conn, 'media', columns, data, 'media');
}

async function migrateProductMedia(
  dump: Map<string, Record<string, any>[]>,
  conn: mysql.Connection,
  plan: ImportPlan,
) {
  log('Migrating product_media...');
  const rows = getRows(dump, 'product_image').filter(
    (r) => r.deleted_at == null,
  );
  const columns = [
    'id',
    'product_id',
    'media_id',
    'is_thumbnail',
    'display_order',
  ];
  const data: any[][] = [];
  const seenPairs = new Set<string>();
  const productOrderMap = new Map<string, number>();

  for (const r of rows) {
    if (!plan.productIdsToImport.has(r.product_id)) {
      skip('product_media', 'product not imported');
      continue;
    }

    const productUuid = resolveId('products', r.product_id);
    const mediaUuid = resolveId('media', r.image_id);
    if (!productUuid || !mediaUuid) {
      skip('product_media', 'FK not resolved');
      continue;
    }

    const pairKey = `${productUuid}:${mediaUuid}`;
    if (seenPairs.has(pairKey)) {
      skip('product_media', 'duplicate product+media pair');
      continue;
    }
    seenPairs.add(pairKey);

    const order = productOrderMap.get(productUuid) || 0;
    productOrderMap.set(productUuid, order + 1);
    data.push([
      randomUUID(),
      productUuid,
      mediaUuid,
      r.is_thumbnail ? 1 : 0,
      order,
    ]);
  }

  await batchInsert(conn, 'product_media', columns, data, 'product_media');
}

async function migrateUsers(
  dump: Map<string, Record<string, any>[]>,
  conn: mysql.Connection,
  plan: ImportPlan,
) {
  log('Migrating users...');
  const users = getRows(dump, 'users');
  const details = getRows(dump, 'user_details');
  const detailMap = new Map<number, Record<string, any>>();
  for (const d of details) detailMap.set(d.user_id, d);

  const columns = [
    'id',
    'first_name',
    'last_name',
    'email',
    'email_lookup',
    'password_hash',
    'phone',
    'status',
    'two_factor_enabled',
    'last_login_at',
    'created_at',
    'updated_at',
    'deleted_at',
  ];
  const data: any[][] = [];
  const usedEmailLookups = new Set<string>();

  for (const u of users) {
    if (!plan.userIdsToImport.has(u.id)) {
      skip('users', 'deleted + no orders');
      continue;
    }

    const uuid = mapId('users', u.id);
    const detail = detailMap.get(u.id);
    let firstName: string, lastName: string;
    if (detail?.firstname) {
      firstName = String(detail.firstname).trim();
      lastName = String(detail.lastname || '').trim();
    } else {
      const parts = String(u.username).trim().split(/\s+/);
      firstName = parts[0] || 'Unknown';
      lastName = parts.slice(1).join(' ') || '';
    }

    // email_lookup is NOT NULL + unique — every user needs a distinct hash.
    // Missing/old-encrypted emails and duplicates get a unique placeholder.
    let email = String(u.email || '').trim();
    if (!email || isEncrypted(email)) email = `legacy-user-${u.id}@vseeds.local`;
    let lookup = emailLookupHash(email);
    if (usedEmailLookups.has(lookup)) {
      email = `legacy-user-${u.id}@vseeds.local`;
      lookup = emailLookupHash(email);
    }
    usedEmailLookups.add(lookup);

    data.push([
      uuid,
      firstName,
      lastName,
      email,
      lookup,
      u.password,
      detail?.phone || null,
      u.status == 1 ? 'active' : 'inactive',
      0,
      null,
      safeDate(u.created_at) || nowStr(),
      nowStr(),
      safeDate(u.deleted_at),
    ]);
  }

  await batchInsert(conn, 'users', columns, data, 'users');
}

async function migrateUserAddresses(
  dump: Map<string, Record<string, any>[]>,
  conn: mysql.Connection,
  plan: ImportPlan,
) {
  log('Migrating user_addresses...');
  const rows = getRows(dump, 'user_address');
  const details = getRows(dump, 'user_details');
  const users = getRows(dump, 'users');

  const detailMap = new Map<number, Record<string, any>>();
  for (const d of details) detailMap.set(d.user_id, d);
  const userMap = new Map<number, Record<string, any>>();
  for (const u of users) userMap.set(u.id, u);

  const columns = [
    'id',
    'user_id',
    'label',
    'full_name',
    'email',
    'phone',
    'address_line1',
    'address_line2',
    'city',
    'district',
    'province',
    'postal_code',
    'country',
    'is_default',
    'created_at',
    'updated_at',
    'deleted_at',
  ];
  const data: any[][] = [];

  for (const r of rows) {
    if (!plan.addressIdsToImport.has(r.id)) {
      skip('user_addresses', 'user not imported');
      continue;
    }

    if (isEncrypted(r.address_line1) || isEncrypted(r.district)) {
      skip('user_addresses', 'encrypted / corrupted data');
      continue;
    }

    const uuid = mapId('user_addresses', r.id);
    const userUuid = resolveId('users', r.user_id);
    if (!userUuid) {
      skip('user_addresses', 'user FK not resolved');
      continue;
    }

    const detail = detailMap.get(r.user_id);
    const user = userMap.get(r.user_id);
    const fullName = detail
      ? `${detail.firstname} ${detail.lastname}`.trim()
      : user?.username || 'Unknown';

    data.push([
      uuid,
      userUuid,
      null,
      fullName,
      user?.email || null,
      r.phone || null,
      r.address_line1 || '',
      r.address_line2 || null,
      null,
      r.district || '',
      r.province || '',
      r.postcode || '',
      r.country || 'Sri Lanka',
      r.status == 1 ? 1 : 0,
      safeDate(r.created_at) || nowStr(),
      safeDate(r.updated_at) || nowStr(),
      null,
    ]);
  }

  await batchInsert(conn, 'user_addresses', columns, data, 'user_addresses');
}

async function migrateOrders(
  dump: Map<string, Record<string, any>[]>,
  conn: mysql.Connection,
) {
  log('Migrating orders...');
  const orders = getRows(dump, 'orders');
  const comments = getRows(dump, 'order_comments');
  const commentMap = new Map<number, Record<string, any>>();
  for (const c of comments) commentMap.set(c.order_id, c);

  const columns = [
    'id',
    'order_number',
    'user_id',
    'shipping_address_id',
    'order_type',
    'quote_id',
    'subtotal',
    'shipping_fee',
    'discount_amount',
    'promo_code',
    'promo_code_id',
    'total_amount',
    'status',
    'customer_notes',
    'admin_notes',
    'created_at',
    'updated_at',
    'deleted_at',
  ];
  const data: any[][] = [];

  for (const o of orders) {
    const userUuid = resolveId('users', o.user_id);
    if (!userUuid) {
      skip('orders', 'user not imported');
      continue;
    }

    const uuid = mapId('orders', o.id);
    const comment = commentMap.get(o.id);
    const shippingAddrUuid = comment?.address_id
      ? resolveId('user_addresses', comment.address_id)
      : null;

    const orderDate = new Date(o.order_date);
    const dateStr = `${orderDate.getFullYear()}${pad(orderDate.getMonth() + 1, 2)}${pad(orderDate.getDate(), 2)}`;
    const orderNumber = `ORD-${dateStr}-${pad(o.id, 5)}`;

    const shippingFee = parseFloat(o.shipping_fee) || 0;
    const totalAmount = parseFloat(o.total_amount) || 0;
    const subtotal = Math.max(0, totalAmount - shippingFee);

    data.push([
      uuid,
      orderNumber,
      userUuid,
      shippingAddrUuid,
      'product',
      null,
      subtotal,
      shippingFee,
      0,
      null,
      null,
      totalAmount,
      mapOrderStatus(o.order_status),
      comment?.comments || null,
      null,
      safeDate(o.order_date) || nowStr(),
      nowStr(),
      null,
    ]);
  }

  await batchInsert(conn, 'orders', columns, data, 'orders');
}

async function migrateOrderItems(
  dump: Map<string, Record<string, any>[]>,
  conn: mysql.Connection,
) {
  log('Migrating order_items...');
  const rows = getRows(dump, 'order_items');
  const products = getRows(dump, 'products_list');
  const productNameMap = new Map<number, string>();
  for (const p of products) productNameMap.set(p.id, p.name);

  const columns = [
    'id',
    'order_id',
    'product_id',
    'product_name',
    'quantity',
    'unit_price',
    'total_price',
  ];
  const data: any[][] = [];

  for (const r of rows) {
    const orderUuid = resolveId('orders', r.order_id);
    if (!orderUuid) {
      skip('order_items', 'order not imported');
      continue;
    }

    const productUuid = resolveId('products', r.product_id);
    const productName =
      productNameMap.get(r.product_id) || `Product #${r.product_id}`;
    const unitPrice = parseFloat(r.price) || 0;
    const quantity = r.quantity || 1;

    data.push([
      randomUUID(),
      orderUuid,
      productUuid,
      productName,
      quantity,
      unitPrice,
      unitPrice * quantity,
    ]);
  }

  await batchInsert(conn, 'order_items', columns, data, 'order_items');
}

async function migratePayments(
  dump: Map<string, Record<string, any>[]>,
  conn: mysql.Connection,
) {
  log('Migrating payments...');
  const rows = getRows(dump, 'payments').filter((r) => r.deleted_at == null);
  const allRows = getRows(dump, 'payments');
  const deletedCount = allRows.length - rows.length;
  if (deletedCount > 0)
    log(`  Filtering out ${deletedCount} soft-deleted payment(s)`);

  const columns = [
    'id',
    'payment_number',
    'order_id',
    'amount',
    'payment_method',
    'status',
    'reference_number',
    'receipt_url',
    'paid_at',
    'created_at',
    'updated_at',
  ];
  const data: any[][] = [];

  for (const r of rows) {
    const orderUuid = resolveId('orders', r.order_id);
    if (!orderUuid) {
      skip('payments', 'order not imported');
      continue;
    }

    const uuid = mapId('payments', r.id);
    const createdDate = new Date(r.created_at);
    const dateStr = `${createdDate.getFullYear()}${pad(createdDate.getMonth() + 1, 2)}${pad(createdDate.getDate(), 2)}`;
    const paymentNumber = `PAY-${dateStr}-${pad(r.id, 5)}`;

    let paidAt: string | null = null;
    try {
      const statusJson = tryParseJson(r.status);
      if (statusJson?.completed)
        paidAt = safeDate(new Date(statusJson.completed));
    } catch {
      /* ignore */
    }

    data.push([
      uuid,
      paymentNumber,
      orderUuid,
      parseFloat(r.amount) || 0,
      'bank_transfer',
      mapPaymentStatus(r.payment_status),
      null,
      null,
      paidAt,
      safeDate(r.created_at) || nowStr(),
      nowStr(),
    ]);
  }

  await batchInsert(conn, 'payments', columns, data, 'payments');
}

async function migrateShipments(
  dump: Map<string, Record<string, any>[]>,
  conn: mysql.Connection,
) {
  log('Migrating shipments...');
  const rows = getRows(dump, 'shipment');
  const columns = [
    'id',
    'order_id',
    'tracking_number',
    'carrier',
    'shipped_at',
    'expected_delivery_at',
    'delivered_at',
    'shipping_fee',
    'created_at',
    'updated_at',
  ];
  const data: any[][] = [];

  for (const r of rows) {
    const orderUuid = resolveId('orders', r.order_id);
    if (!orderUuid) {
      skip('shipments', 'order not imported');
      continue;
    }

    const uuid = mapId('shipments', r.id);
    const shippedAt = safeDate(r.shipping_date);
    data.push([
      uuid,
      orderUuid,
      r.tracking_number || null,
      r.carrier || null,
      shippedAt,
      safeDate(r.expected_delivery_date),
      null,
      parseFloat(r.shipping_fees) || 0,
      shippedAt || nowStr(),
      nowStr(),
    ]);
  }

  await batchInsert(conn, 'shipments', columns, data, 'shipments');
}

async function migrateProductReviews(
  dump: Map<string, Record<string, any>[]>,
  conn: mysql.Connection,
) {
  log('Migrating product_reviews...');
  const rows = getRows(dump, 'product_reviews');
  const columns = [
    'id',
    'product_id',
    'user_id',
    'rating',
    'review_text',
    'image_url',
    'admin_reply',
    'admin_reply_at',
    'is_approved',
    'order_id',
    'quote_id',
    'created_at',
    'updated_at',
    'deleted_at',
  ];
  const data: any[][] = [];

  for (const r of rows) {
    const productUuid = resolveId('products', r.product_id);
    const userUuid = resolveId('users', r.user_id);
    if (!productUuid) {
      skip('product_reviews', 'product not imported');
      continue;
    }
    if (!userUuid) {
      skip('product_reviews', 'user not imported');
      continue;
    }

    data.push([
      randomUUID(),
      productUuid,
      userUuid,
      r.rating,
      r.review_text || null,
      r.img_url || null,
      r.admin_reply || null,
      null,
      1,
      null,
      null,
      safeDate(r.review_date) || nowStr(),
      nowStr(),
      null,
    ]);
  }

  await batchInsert(conn, 'product_reviews', columns, data, 'product_reviews');
}

// ────────────────────────────────────────────────────────────────────────────
// Validation
// ────────────────────────────────────────────────────────────────────────────

async function validate(
  dump: Map<string, Record<string, any>[]>,
  conn: mysql.Connection,
) {
  log('\n── Post-migration validation ──');

  const entities = [
    'categories',
    'products',
    'product_price_tiers',
    'media',
    'product_media',
    'users',
    'user_addresses',
    'orders',
    'order_items',
    'payments',
    'shipments',
    'product_reviews',
  ];

  console.log(
    '\n┌──────────────────────┬──────────┬─────────┬────────┬───────────────────────────────────────────┐',
  );
  console.log(
    '│ Entity               │ Imported │ Skipped │ Errors │ Skip reasons                              │',
  );
  console.log(
    '├──────────────────────┼──────────┼─────────┼────────┼───────────────────────────────────────────┤',
  );

  for (const entity of entities) {
    const s = stats.get(entity) || {
      imported: 0,
      skipped: 0,
      errors: 0,
      skipReasons: new Map(),
    };
    const reasons =
      Array.from(s.skipReasons.entries())
        .map(([r, c]) => `${r}(${c})`)
        .join(', ') || '-';
    console.log(
      `│ ${entity.padEnd(20)} │ ${String(s.imported).padStart(8)} │ ${String(s.skipped).padStart(7)} │ ${String(s.errors).padStart(6)} │ ${reasons.substring(0, 41).padEnd(41)} │`,
    );
  }

  console.log(
    '└──────────────────────┴──────────┴─────────┴────────┴───────────────────────────────────────────┘',
  );

  // Skipped old tables
  const skippedTables = [
    'admins',
    'roles',
    'privileges',
    'role_privileges',
    'activity_logs',
    'contact',
    'contact_replay',
    'wishlist',
    'email_templates',
    'history',
    'migrations',
    'payment_methods',
    'quotes',
    'resetpassword',
  ];
  const skippedReasons: Record<string, string> = {
    admins: 'create fresh admin accounts via seed.ts',
    roles: 'new RBAC system managed by seed.ts',
    privileges: 'new RBAC system managed by seed.ts',
    role_privileges: 'new RBAC system managed by seed.ts',
    activity_logs: 'old audit trail; new system generates its own',
    contact: 'old support messages; not essential',
    contact_replay: 'old support replies; not essential',
    wishlist: 'stale user preferences; low value',
    email_templates: 'empty table; new system has its own',
    history: 'empty table; not used',
    migrations: 'internal framework tracking',
    payment_methods: 'config data; hardcoded in new system',
    quotes: 'empty table; new system handles quotes',
    resetpassword: 'temporary tokens; irrelevant',
  };

  console.log('\n  Intentionally skipped old tables:');
  for (const t of skippedTables) {
    const count = (dump.get(t) || []).length;
    console.log(`    ✕ ${t} (${count} rows) → ${skippedReasons[t]}`);
  }

  // FK integrity checks (live mode only)
  if (!DRY_RUN) {
    console.log('\n  FK integrity checks:');
    const fkChecks = [
      {
        label: 'Orders → Users',
        sql: `SELECT COUNT(*) as cnt FROM \`${NEW_DB}\`.orders o LEFT JOIN \`${NEW_DB}\`.users u ON o.user_id = u.id WHERE u.id IS NULL`,
      },
      {
        label: 'Order Items → Orders',
        sql: `SELECT COUNT(*) as cnt FROM \`${NEW_DB}\`.order_items oi LEFT JOIN \`${NEW_DB}\`.orders o ON oi.order_id = o.id WHERE o.id IS NULL`,
      },
      {
        label: 'Order Items → Products',
        sql: `SELECT COUNT(*) as cnt FROM \`${NEW_DB}\`.order_items oi LEFT JOIN \`${NEW_DB}\`.products p ON oi.product_id = p.id WHERE oi.product_id IS NOT NULL AND p.id IS NULL`,
      },
      {
        label: 'Payments → Orders',
        sql: `SELECT COUNT(*) as cnt FROM \`${NEW_DB}\`.payments p LEFT JOIN \`${NEW_DB}\`.orders o ON p.order_id = o.id WHERE o.id IS NULL`,
      },
      {
        label: 'Product Media → Products',
        sql: `SELECT COUNT(*) as cnt FROM \`${NEW_DB}\`.product_media pm LEFT JOIN \`${NEW_DB}\`.products p ON pm.product_id = p.id WHERE p.id IS NULL`,
      },
      {
        label: 'Product Media → Media',
        sql: `SELECT COUNT(*) as cnt FROM \`${NEW_DB}\`.product_media pm LEFT JOIN \`${NEW_DB}\`.media m ON pm.media_id = m.id WHERE m.id IS NULL`,
      },
      {
        label: 'User Addresses → Users',
        sql: `SELECT COUNT(*) as cnt FROM \`${NEW_DB}\`.user_addresses ua LEFT JOIN \`${NEW_DB}\`.users u ON ua.user_id = u.id WHERE u.id IS NULL`,
      },
      {
        label: 'Shipments → Orders',
        sql: `SELECT COUNT(*) as cnt FROM \`${NEW_DB}\`.shipments s LEFT JOIN \`${NEW_DB}\`.orders o ON s.order_id = o.id WHERE o.id IS NULL`,
      },
      {
        label: 'Reviews → Products',
        sql: `SELECT COUNT(*) as cnt FROM \`${NEW_DB}\`.product_reviews pr LEFT JOIN \`${NEW_DB}\`.products p ON pr.product_id = p.id WHERE p.id IS NULL`,
      },
      {
        label: 'Reviews → Users',
        sql: `SELECT COUNT(*) as cnt FROM \`${NEW_DB}\`.product_reviews pr LEFT JOIN \`${NEW_DB}\`.users u ON pr.user_id = u.id WHERE u.id IS NULL`,
      },
    ];

    let allGood = true;
    for (const fk of fkChecks) {
      try {
        const [result] = await conn.query<mysql.RowDataPacket[]>(fk.sql);
        const orphans = result[0].cnt;
        if (orphans > 0) {
          logWarn(`    ${fk.label}: ${orphans} orphan(s)`);
          allGood = false;
        } else console.log(`    ✓ ${fk.label}: OK`);
      } catch (err: any) {
        logErr(`    ${fk.label}: ${err.message}`);
      }
    }

    console.log(
      allGood
        ? '\n  All FK checks passed!'
        : '\n  Some FK checks reported issues.',
    );
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log(
    '═══════════════════════════════════════════════════════════════',
  );
  console.log(' VSEEDS Selective Data Migration: SQL Dump → New System');
  console.log(`  Source:  ${SQL_DUMP_PATH}`);
  console.log(`  Target:  ${NEW_DB}`);
  console.log(
    `  Mode:    ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE MIGRATION'}`,
  );
  console.log(
    '═══════════════════════════════════════════════════════════════\n',
  );

  const dump = parseSqlDump(SQL_DUMP_PATH);
  const plan = buildImportPlan(dump);

  let conn: mysql.Connection | null = null;

  if (!DRY_RUN) {
    conn = await mysql.createConnection({
      ...DB_CONFIG,
      multipleStatements: true,
      dateStrings: true,
    });
    try {
      await conn.query(`SELECT 1 FROM \`${NEW_DB}\`.products LIMIT 1`);
      log('New DB connection verified.\n');
    } catch (err: any) {
      logErr(`Cannot access new database "${NEW_DB}": ${err.message}`);
      await conn.end();
      process.exit(1);
    }
    await conn.query(`SET FOREIGN_KEY_CHECKS = 0`);
    await conn.query(`SET sql_mode = ''`);
  }

  const dbConn = conn as any;

  try {
    const startTime = Date.now();

    // Phase 1: Categories (no FK deps)
    await migrateCategories(dump, dbConn, plan);

    // Phase 2: Products → depends on categories
    await migrateProducts(dump, dbConn, plan);

    // Phase 3: Media → only product-linked
    await migrateMedia(dump, dbConn, plan);
    await migrateProductMedia(dump, dbConn, plan);

    // Phase 4: Users + Addresses
    await migrateUsers(dump, dbConn, plan);
    await migrateUserAddresses(dump, dbConn, plan);

    // Phase 5: Orders → depends on users + addresses
    await migrateOrders(dump, dbConn);
    await migrateOrderItems(dump, dbConn);
    await migratePayments(dump, dbConn);
    await migrateShipments(dump, dbConn);

    // Phase 6: Reviews → depends on products + users
    await migrateProductReviews(dump, dbConn);

    if (!DRY_RUN && conn) await conn.query(`SET FOREIGN_KEY_CHECKS = 1`);

    log(
      `\nMigration complete in ${((Date.now() - startTime) / 1000).toFixed(1)}s`,
    );
    await validate(dump, dbConn);
  } catch (err: any) {
    logErr(`Migration failed: ${err.message}`);
    console.error(err);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
}

main().catch((err) => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
main().catch((err) => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
