import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Placeholder initial migration.
 * Schema is currently managed by synchronize in non-production.
 * For a fresh production DB, generate a migration from entities:
 *   npm run build && npm run migration:generate -- src/migrations/InitialSchema
 * Then run: npm run migration:run
 */
export class InitialSchema1731283200000 implements MigrationInterface {
  public async up(_queryRunner: QueryRunner): Promise<void> {
    // No-op: real initial migration can be generated from entities
    void _queryRunner;
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // No-op
    void _queryRunner;
  }
}
