import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as mysql from 'mysql2/promise';

export type DumpType = 'latest' | 'old';

export interface DumpMeta {
  fileName: string;
  size: number;
  uploadedAt: string;
}

export interface ImportStatus {
  type: DumpType;
  status: 'running' | 'success' | 'failed';
  startedAt: string;
  finishedAt?: string;
  logTail: string[];
  error?: string;
}

const DUMP_FILES: Record<DumpType, string> = {
  latest: 'latest_db.sql',
  old: 'old_db.sql',
};

/**
 * Tables never truncated by the "clear existing data" option:
 * auth/RBAC (keeps admins logged in — the migration skips these anyway) and
 * system config tables that neither import path restores.
 */
const PRESERVE_TABLES = new Set([
  'admins',
  'roles',
  'privileges',
  'role_privileges',
  'settings',
  'email_templates',
  'invoice_templates',
  'banks',
  '_prisma_migrations',
]);

@Injectable()
export class DatabaseService {
  private readonly logger = new Logger(DatabaseService.name);
  private readonly dumpsDir = path.resolve(process.cwd(), 'db-dumps');
  private readonly metaPath = path.join(this.dumpsDir, 'meta.json');
  private readonly statuses = new Map<DumpType, ImportStatus>();

  constructor(private readonly config: ConfigService) {
    fs.mkdirSync(this.dumpsDir, { recursive: true });
  }

  dumpPath(type: DumpType): string {
    return path.join(this.dumpsDir, DUMP_FILES[type]);
  }

  private readMeta(): Partial<Record<DumpType, DumpMeta>> {
    try {
      return JSON.parse(fs.readFileSync(this.metaPath, 'utf-8'));
    } catch {
      return {};
    }
  }

  private writeMeta(meta: Partial<Record<DumpType, DumpMeta>>) {
    fs.writeFileSync(this.metaPath, JSON.stringify(meta, null, 2));
  }

  registerUpload(type: DumpType, file: Express.Multer.File): DumpMeta {
    const meta = this.readMeta();
    const entry: DumpMeta = {
      fileName: file.originalname,
      size: file.size,
      uploadedAt: new Date().toISOString(),
    };
    meta[type] = entry;
    this.writeMeta(meta);
    return entry;
  }

  getDumps() {
    const meta = this.readMeta();
    const result: Record<DumpType, (DumpMeta & { exists: boolean }) | null> = {
      latest: null,
      old: null,
    };
    for (const type of Object.keys(DUMP_FILES) as DumpType[]) {
      const m = meta[type];
      const exists = fs.existsSync(this.dumpPath(type));
      result[type] = m && exists ? { ...m, exists } : null;
    }
    return result;
  }

  getImportStatus(type?: DumpType) {
    if (type) return this.statuses.get(type) ?? null;
    return {
      latest: this.statuses.get('latest') ?? null,
      old: this.statuses.get('old') ?? null,
    };
  }

  private pushLog(st: ImportStatus, line: string) {
    st.logTail.push(line);
    if (st.logTail.length > 200) st.logTail.shift();
    this.logger.log(line);
  }

  private dbConfig() {
    const url = this.config.get<string>('DATABASE_URL');
    let fromUrl: Partial<{
      host: string;
      port: number;
      user: string;
      password: string;
      database: string;
    }> = {};
    if (url) {
      try {
        const u = new URL(url);
        fromUrl = {
          host: u.hostname,
          port: Number(u.port) || 3306,
          user: decodeURIComponent(u.username),
          password: decodeURIComponent(u.password),
          database: u.pathname.replace(/^\//, ''),
        };
      } catch {
        /* fall through to discrete vars */
      }
    }
    return {
      host: this.config.get<string>('DB_HOST') || fromUrl.host || 'localhost',
      port: Number(this.config.get<string>('DB_PORT')) || fromUrl.port || 3306,
      user: this.config.get<string>('DB_USER') || fromUrl.user,
      password: this.config.get<string>('DB_PASSWORD') || fromUrl.password,
      database: this.config.get<string>('DATABASE') || fromUrl.database,
    };
  }

  /** Split a mysqldump-style file into statements (line-boundary split). */
  private splitStatements(sql: string): string[] {
    const statements: string[] = [];
    let chunk = '';
    for (const line of sql.split('\n')) {
      chunk += line + '\n';
      if (line.trimEnd().endsWith(';')) {
        statements.push(chunk);
        chunk = '';
      }
    }
    if (chunk.trim()) statements.push(chunk);
    return statements
      .map((s) =>
        s
          .split('\n')
          .filter((l) => !l.trimStart().startsWith('--'))
          .join('\n')
          .trim(),
      )
      .filter((s) => s.length > 0 && s !== ';');
  }

  /**
   * Detect whether a dump is a legacy-schema file (old table names like
   * products_list/user_address) or a current-schema file (order_number,
   * email_lookup). Used to reject files uploaded to the wrong slot.
   */
  private sniffDumpFormat(filePath: string): 'legacy' | 'current' | 'unknown' {
    let content: string;
    try {
      content = fs.readFileSync(filePath, 'utf-8');
    } catch {
      return 'unknown';
    }
    const hasLegacy =
      /CREATE TABLE `?(products_list|user_address|user_details|image_details|product_image|resetpassword|contact_replay)`?/i.test(
        content,
      );
    const hasCurrent =
      /`(order_number|email_lookup|username_lookup|product_price_tiers|sub_categories)`/i.test(
        content,
      );
    if (hasLegacy && !hasCurrent) return 'legacy';
    if (hasCurrent && !hasLegacy) return 'current';
    return 'unknown';
  }

  async importDump(
    type: DumpType,
    clearFirst = false,
  ): Promise<{ started: boolean }> {
    const filePath = this.dumpPath(type);
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException(
        `No ${type} SQL dump uploaded. Upload a file first.`,
      );
    }

    const format = this.sniffDumpFormat(filePath);
    if (type === 'old' && format === 'current') {
      throw new BadRequestException(
        'This file is a current-schema dump, not a legacy one. Upload it under "Latest DB SQL" and use Run Import instead.',
      );
    }
    if (type === 'latest' && format === 'legacy') {
      throw new BadRequestException(
        'This file is a legacy-schema dump. Upload it under "Old DB SQL" and use Run Migration instead.',
      );
    }

    const existing = this.statuses.get(type);
    if (existing?.status === 'running') {
      throw new BadRequestException(`An import for "${type}" is already running`);
    }

    const st: ImportStatus = {
      type,
      status: 'running',
      startedAt: new Date().toISOString(),
      logTail: [],
    };
    this.statuses.set(type, st);

    if (type === 'latest') {
      void this.runLatestImport(filePath, st, clearFirst);
    } else {
      void this.runOldImport(filePath, st, clearFirst);
    }
    return { started: true };
  }

  /**
   * Truncate every base table except PRESERVE_TABLES.
   * Expects the caller to have disabled FOREIGN_KEY_CHECKS on the connection.
   */
  private async truncateTables(
    conn: mysql.Connection,
    st?: ImportStatus,
  ): Promise<string[]> {
    const [rows] = await conn.query<mysql.RowDataPacket[]>(
      `SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'`,
    );
    const tables = rows
      .map((r) => String(Object.values(r)[0]))
      .filter((t) => !PRESERVE_TABLES.has(t));

    for (const t of tables) {
      await conn.query(`TRUNCATE TABLE \`${t}\``);
    }

    const msg = `Cleared ${tables.length} tables (kept: ${[...PRESERVE_TABLES].join(', ')})`;
    if (st) this.pushLog(st, msg);
    else this.logger.log(msg);
    return tables;
  }

  /** Execute a full SQL dump of the CURRENT schema directly against the DB. */
  private async runLatestImport(
    filePath: string,
    st: ImportStatus,
    clearFirst = false,
  ) {
    const cfg = this.dbConfig();
    if (!cfg.user || !cfg.database) {
      st.status = 'failed';
      st.finishedAt = new Date().toISOString();
      st.error = 'Database credentials not configured (DB_USER/DATABASE or DATABASE_URL)';
      this.pushLog(st, st.error);
      return;
    }

    let conn: mysql.Connection | null = null;
    try {
      this.pushLog(st, `Reading dump ${filePath}`);
      const sql = fs.readFileSync(filePath, 'utf-8');
      const statements = this.splitStatements(sql);
      this.pushLog(st, `Executing ${statements.length} statements...`);

      conn = await mysql.createConnection({
        host: cfg.host,
        port: cfg.port,
        user: cfg.user,
        password: cfg.password,
        database: cfg.database,
        multipleStatements: true,
      });

      await conn.query('SET FOREIGN_KEY_CHECKS=0');
      await conn.query('SET UNIQUE_CHECKS=0');

      if (clearFirst) {
        this.pushLog(st, 'Clearing existing data before import...');
        await this.truncateTables(conn, st);
      }

      let executed = 0;
      const errors: string[] = [];
      for (const stmt of statements) {
        try {
          await conn.query(stmt);
          executed++;
        } catch (e: any) {
          errors.push(e?.message || String(e));
          if (errors.length <= 20) this.pushLog(st, `ERR: ${e?.message}`);
        }
      }

      await conn.query('SET FOREIGN_KEY_CHECKS=1');
      await conn.query('SET UNIQUE_CHECKS=1');

      if (errors.length === 0) {
        this.pushLog(st, `Done. ${executed} statements executed.`);
        await this.syncSchema(st);
        st.status = 'success';
      } else {
        st.status = 'failed';
        st.error = `${errors.length} statement(s) failed (${executed} succeeded)`;
        this.pushLog(st, st.error);
      }
      st.finishedAt = new Date().toISOString();
    } catch (e: any) {
      st.status = 'failed';
      st.finishedAt = new Date().toISOString();
      st.error = e?.message || String(e);
      this.pushLog(st, `FATAL: ${st.error}`);
    } finally {
      await conn?.end().catch(() => undefined);
    }
  }

  /**
   * Generate a full SQL backup of the live database.
   * Portable implementation using mysql2 — no mysqldump binary required.
   */
  async createBackup(): Promise<{ filePath: string; fileName: string }> {
    const cfg = this.dbConfig();
    if (!cfg.user || !cfg.database) {
      throw new BadRequestException(
        'Database credentials not configured (DB_USER/DATABASE or DATABASE_URL)',
      );
    }

    const stamp = new Date()
      .toISOString()
      .replace(/[:T]/g, '-')
      .slice(0, 19);
    const fileName = `backup_${cfg.database}_${stamp}.sql`;
    const filePath = path.join(this.dumpsDir, fileName);

    const conn = await mysql.createConnection({
      host: cfg.host,
      port: cfg.port,
      user: cfg.user,
      password: cfg.password,
      database: cfg.database,
    });

    const out = fs.createWriteStream(filePath);
    const write = (s: string) =>
      new Promise<void>((res, rej) => {
        const ok = out.write(s, (e) => (e ? rej(e) : undefined));
        if (!ok) out.once('drain', res);
        else res();
      });

    try {
      await write(
        `-- VSEEDS Database Backup\n` +
          `-- Database: ${cfg.database}\n` +
          `-- Generated: ${new Date().toISOString()}\n\n` +
          `SET FOREIGN_KEY_CHECKS=0;\nSET UNIQUE_CHECKS=0;\nSET SQL_MODE='NO_AUTO_VALUE_ON_ZERO';\n\n`,
      );

      const [tables] = await conn.query<mysql.RowDataPacket[]>('SHOW FULL TABLES');
      for (const row of tables) {
        const [name, tableType] = Object.values(row) as [string, string];

        if (tableType === 'VIEW') {
          const [v] = await conn.query<mysql.RowDataPacket[]>(
            `SHOW CREATE VIEW \`${name}\``,
          );
          const createSql = v[0]?.['Create View'];
          if (createSql) {
            await write(
              `-- View: ${name}\nDROP VIEW IF EXISTS \`${name}\`;\n${createSql};\n\n`,
            );
          }
          continue;
        }

        const [c] = await conn.query<mysql.RowDataPacket[]>(
          `SHOW CREATE TABLE \`${name}\``,
        );
        const createSql = c[0]?.['Create Table'];
        if (!createSql) continue;

        await write(
          `-- Table: ${name}\nDROP TABLE IF EXISTS \`${name}\`;\n${createSql};\n\n`,
        );

        // Page rows in batches to keep memory flat on large tables
        const PAGE = 500;
        let offset = 0;
        let columns: string[] | null = null;
        for (;;) {
          const [rows, fields] = await conn.query<mysql.RowDataPacket[]>(
            `SELECT * FROM \`${name}\` LIMIT ${PAGE} OFFSET ${offset}`,
          );
          if (rows.length === 0) break;
          if (!columns) columns = fields.map((f) => f.name);

          const colList = columns.map((col) => `\`${col}\``).join(',');
          const tuples: string[] = [];
          for (const rec of rows) {
            tuples.push(
              `(${columns.map((col) => conn.escape(rec[col])).join(',')})`,
            );
          }
          await write(
            `INSERT INTO \`${name}\` (${colList}) VALUES\n${tuples.join(',\n')};\n`,
          );

          offset += rows.length;
          if (rows.length < PAGE) break;
        }
        await write('\n');
      }

      await write(`SET FOREIGN_KEY_CHECKS=1;\nSET UNIQUE_CHECKS=1;\n`);
    } finally {
      await conn.end().catch(() => undefined);
      await new Promise<void>((res, rej) =>
        out.end((e: any) => (e ? rej(e) : res())),
      );
    }

    return { filePath, fileName };
  }

  /**
   * After a full-dump restore, sync schema drift (e.g. columns added since the
   * dump was taken, like reset_token) via `prisma db push`. --accept-data-loss
   * is required because prisma prompts even for benign casts (e.g.
   * Timestamp(0) → Timestamp); safe here since this only runs after a full
   * restore the user already confirmed. --skip-generate avoids the Windows
   * EPERM when the dev server holds the query-engine DLL. On any failure we
   * just log a warning; the restored data is unaffected.
   */
  private syncSchema(st: ImportStatus): Promise<void> {
    return new Promise((resolve) => {
      const root = process.cwd();
      const prismaBin = path.join(
        root,
        'node_modules',
        'prisma',
        'build',
        'index.js',
      );
      if (!fs.existsSync(prismaBin)) {
        this.pushLog(
          st,
          'WARN: prisma CLI not found — run `npx prisma db push` manually',
        );
        return resolve();
      }

      this.pushLog(st, 'Syncing schema (prisma db push)...');
      const child = spawn(
        process.execPath,
        [prismaBin, 'db', 'push', '--skip-generate', '--accept-data-loss'],
        { cwd: root, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] },
      );
      const kill = setTimeout(() => child.kill(), 120_000);

      child.stdout.on('data', (d: Buffer) =>
        d
          .toString()
          .split('\n')
          .filter(Boolean)
          .forEach((l) => this.pushLog(st, l)),
      );
      child.stderr.on('data', (d: Buffer) =>
        d
          .toString()
          .split('\n')
          .filter(Boolean)
          .forEach((l) => this.pushLog(st, `ERR: ${l}`)),
      );
      child.on('error', (e) => {
        clearTimeout(kill);
        this.pushLog(
          st,
          `WARN: schema sync failed (${e.message}) — run \`npx prisma db push\` manually`,
        );
        resolve();
      });
      child.on('close', (code) => {
        clearTimeout(kill);
        this.pushLog(
          st,
          code === 0
            ? 'Schema synced.'
            : `WARN: schema sync exited ${code} — run \`npx prisma db push\` manually`,
        );
        resolve();
      });
    });
  }

  /**
   * Re-run seed.ts after a legacy migration to restore default content the
   * old dump doesn't carry (FAQs, settings, email templates, RBAC). The seed
   * is idempotent — it only creates missing rows. Failures are non-fatal.
   */
  private runSeed(st: ImportStatus): Promise<void> {
    return new Promise((resolve) => {
      const root = process.cwd();
      const tsNodeBin = path.join(
        root,
        'node_modules',
        'ts-node',
        'dist',
        'bin.js',
      );
      const seedScript = path.join(root, 'src', 'seed.ts');
      if (!fs.existsSync(seedScript) || !fs.existsSync(tsNodeBin)) {
        this.pushLog(
          st,
          'WARN: seed script not found — run `npm run seed` manually',
        );
        return resolve();
      }

      this.pushLog(st, 'Restoring default content (seed)...');
      const child = spawn(
        process.execPath,
        [
          tsNodeBin,
          '--transpile-only',
          '-r',
          'tsconfig-paths/register',
          seedScript,
        ],
        { cwd: root, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] },
      );
      const kill = setTimeout(() => child.kill(), 180_000);

      child.stdout.on('data', (d: Buffer) =>
        d
          .toString()
          .split('\n')
          .filter(Boolean)
          .forEach((l) => this.pushLog(st, l)),
      );
      child.stderr.on('data', (d: Buffer) =>
        d
          .toString()
          .split('\n')
          .filter(Boolean)
          .forEach((l) => this.pushLog(st, `ERR: ${l}`)),
      );
      child.on('error', (e) => {
        clearTimeout(kill);
        this.pushLog(
          st,
          `WARN: seed failed (${e.message}) — run \`npm run seed\` manually`,
        );
        resolve();
      });
      child.on('close', (code) => {
        clearTimeout(kill);
        this.pushLog(
          st,
          code === 0
            ? 'Default content restored.'
            : `WARN: seed exited ${code} — run \`npm run seed\` manually`,
        );
        resolve();
      });
    });
  }

  /** Run the existing migrate-old-db script against the uploaded legacy dump. */
  private async runOldImport(
    filePath: string,
    st: ImportStatus,
    clearFirst = false,
  ) {
    if (clearFirst) {
      const cfg = this.dbConfig();
      let conn: mysql.Connection | null = null;
      try {
        this.pushLog(st, 'Clearing existing data before migration...');
        conn = await mysql.createConnection({
          host: cfg.host,
          port: cfg.port,
          user: cfg.user,
          password: cfg.password,
          database: cfg.database,
        });
        await conn.query('SET FOREIGN_KEY_CHECKS=0');
        await this.truncateTables(conn, st);
        await conn.query('SET FOREIGN_KEY_CHECKS=1');
      } catch (e: any) {
        st.status = 'failed';
        st.finishedAt = new Date().toISOString();
        st.error = `Failed to clear database: ${e?.message || e}`;
        this.pushLog(st, `FATAL: ${st.error}`);
        return;
      } finally {
        await conn?.end().catch(() => undefined);
      }
    }

    const root = process.cwd();
    // nest build outputs to dist/src/ when no rootDir is configured
    const distCandidates = [
      path.join(root, 'dist', 'migrate-old-db.js'),
      path.join(root, 'dist', 'src', 'migrate-old-db.js'),
    ];
    const srcScript = path.join(root, 'src', 'migrate-old-db.ts');
    // ts-node's JS entrypoint — run it via node directly so no shell/npx is needed
    const tsNodeBin = path.join(root, 'node_modules', 'ts-node', 'dist', 'bin.js');

    // Use the compiled script only if it's at least as fresh as the source —
    // a stale dist build would silently run outdated migration logic.
    const srcMtime = fs.existsSync(srcScript)
      ? fs.statSync(srcScript).mtimeMs
      : 0;
    const distScript = distCandidates.find(
      (p) => fs.existsSync(p) && fs.statSync(p).mtimeMs >= srcMtime,
    );

    // Always spawn node directly (no shell) — shell:true on Windows breaks on
    // the space in "C:\Program Files\nodejs\node.exe" and in the dump path.
    const cmd = process.execPath;
    const args = distScript
      ? [distScript, `--file=${filePath}`]
      : [
          tsNodeBin,
          '--transpile-only',
          '-r',
          'tsconfig-paths/register',
          srcScript,
          `--file=${filePath}`,
        ];

    this.pushLog(st, `Starting legacy migration: ${cmd} ${args.join(' ')}`);

    const child = spawn(cmd, args, {
      cwd: root,
      env: process.env,
    });

    child.stdout.on('data', (d: Buffer) =>
      d
        .toString()
        .split('\n')
        .filter(Boolean)
        .forEach((l) => this.pushLog(st, l)),
    );
    child.stderr.on('data', (d: Buffer) =>
      d
        .toString()
        .split('\n')
        .filter(Boolean)
        .forEach((l) => this.pushLog(st, `ERR: ${l}`)),
    );

    child.on('error', (e) => {
      st.status = 'failed';
      st.finishedAt = new Date().toISOString();
      st.error = e.message;
      this.pushLog(st, `FATAL: ${e.message}`);
    });

    child.on('close', (code) => {
      if (code === 0) {
        this.pushLog(st, 'Legacy migration completed.');
        // Restore seeded defaults (FAQs etc.) the old dump doesn't carry,
        // then mark success — keeps status 'running' during the seed.
        void this.runSeed(st).then(() => {
          st.status = 'success';
          st.finishedAt = new Date().toISOString();
        });
      } else {
        st.finishedAt = new Date().toISOString();
        st.status = 'failed';
        st.error = `Migration exited with code ${code}`;
        this.pushLog(st, st.error);
      }
    });
  }
}
