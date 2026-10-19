import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds lookup-hash columns for encrypted unique fields and history (_h) tables.
 */
export class EncryptLookupFieldsAndHistoryTables1742881200000
  implements MigrationInterface
{
  name = 'EncryptLookupFieldsAndHistoryTables1742881200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users
        MODIFY COLUMN email VARCHAR(500) NOT NULL,
        ADD COLUMN email_lookup VARCHAR(64) NULL AFTER email;
    `);
    await queryRunner.query(`
      UPDATE users SET email_lookup = SHA2(LOWER(TRIM(email)), 256) WHERE email_lookup IS NULL;
    `);
    await queryRunner.query(`
      ALTER TABLE users
        MODIFY COLUMN email_lookup VARCHAR(64) NOT NULL,
        ADD UNIQUE INDEX idx_user_email_lookup (email_lookup);
    `);

    await queryRunner.query(`
      ALTER TABLE admins
        MODIFY COLUMN username VARCHAR(500) NOT NULL,
        MODIFY COLUMN email VARCHAR(500) NOT NULL,
        ADD COLUMN username_lookup VARCHAR(64) NULL AFTER username,
        ADD COLUMN email_lookup VARCHAR(64) NULL AFTER email;
    `);
    await queryRunner.query(`
      UPDATE admins
      SET username_lookup = SHA2(LOWER(TRIM(username)), 256),
          email_lookup = SHA2(LOWER(TRIM(email)), 256)
      WHERE username_lookup IS NULL OR email_lookup IS NULL;
    `);
    await queryRunner.query(`
      ALTER TABLE admins
        MODIFY COLUMN username_lookup VARCHAR(64) NOT NULL,
        MODIFY COLUMN email_lookup VARCHAR(64) NOT NULL,
        ADD UNIQUE INDEX idx_admin_username_lookup (username_lookup),
        ADD UNIQUE INDEX idx_admin_email_lookup (email_lookup);
    `);

    await queryRunner.query(`
      ALTER TABLE promo_codes
        MODIFY COLUMN code VARCHAR(500) NOT NULL,
        ADD COLUMN code_lookup VARCHAR(64) NULL AFTER code;
    `);
    await queryRunner.query(`
      UPDATE promo_codes SET code_lookup = SHA2(UPPER(TRIM(code)), 256) WHERE code_lookup IS NULL;
    `);
    await queryRunner.query(`
      ALTER TABLE promo_codes
        MODIFY COLUMN code_lookup VARCHAR(64) NOT NULL,
        ADD UNIQUE INDEX idx_promo_code_lookup (code_lookup);
    `);

    await queryRunner.query(`
      ALTER TABLE contacts
        MODIFY COLUMN email VARCHAR(500) NOT NULL;
    `);

    await queryRunner.query(`
      CREATE TABLE users_h (
        id CHAR(36) NOT NULL,
        user_id CHAR(36) NOT NULL,
        action VARCHAR(20) NOT NULL,
        snapshot JSON NOT NULL,
        changed_by CHAR(36) NULL,
        changed_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        INDEX idx_users_h_user (user_id),
        INDEX idx_users_h_changed (changed_at),
        CONSTRAINT FK_users_h_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await queryRunner.query(`
      CREATE TABLE admins_h (
        id CHAR(36) NOT NULL,
        admin_id CHAR(36) NOT NULL,
        action VARCHAR(20) NOT NULL,
        snapshot JSON NOT NULL,
        changed_by CHAR(36) NULL,
        changed_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        INDEX idx_admins_h_admin (admin_id),
        INDEX idx_admins_h_changed (changed_at),
        CONSTRAINT FK_admins_h_admin FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await queryRunner.query(`
      CREATE TABLE promo_codes_h (
        id CHAR(36) NOT NULL,
        promo_code_id CHAR(36) NOT NULL,
        action VARCHAR(20) NOT NULL,
        snapshot JSON NOT NULL,
        changed_by CHAR(36) NULL,
        changed_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        INDEX idx_promo_codes_h_code (promo_code_id),
        INDEX idx_promo_codes_h_changed (changed_at),
        CONSTRAINT FK_promo_codes_h_code FOREIGN KEY (promo_code_id) REFERENCES promo_codes(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await queryRunner.query(`
      CREATE TABLE contacts_h (
        id CHAR(36) NOT NULL,
        contact_id CHAR(36) NOT NULL,
        action VARCHAR(20) NOT NULL,
        snapshot JSON NOT NULL,
        changed_by CHAR(36) NULL,
        changed_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        INDEX idx_contacts_h_contact (contact_id),
        INDEX idx_contacts_h_changed (changed_at),
        CONSTRAINT FK_contacts_h_contact FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS contacts_h');
    await queryRunner.query('DROP TABLE IF EXISTS promo_codes_h');
    await queryRunner.query('DROP TABLE IF EXISTS admins_h');
    await queryRunner.query('DROP TABLE IF EXISTS users_h');
    await queryRunner.query(
      'ALTER TABLE contacts MODIFY COLUMN email VARCHAR(255) NOT NULL',
    );
    await queryRunner.query(
      'ALTER TABLE promo_codes DROP INDEX idx_promo_code_lookup, DROP COLUMN code_lookup, MODIFY COLUMN code VARCHAR(50) NOT NULL',
    );
    await queryRunner.query(
      'ALTER TABLE admins DROP INDEX idx_admin_username_lookup, DROP INDEX idx_admin_email_lookup, DROP COLUMN username_lookup, DROP COLUMN email_lookup, MODIFY COLUMN username VARCHAR(100) NOT NULL, MODIFY COLUMN email VARCHAR(255) NOT NULL',
    );
    await queryRunner.query(
      'ALTER TABLE users DROP INDEX idx_user_email_lookup, DROP COLUMN email_lookup, MODIFY COLUMN email VARCHAR(255) NOT NULL',
    );
  }
}
