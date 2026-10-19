import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration to increase column lengths for encrypted data storage
 * This is required because encrypted data is larger than plain text
 */
export class IncreaseColumnLengthsForEncryption1742794800000 implements MigrationInterface {
  name = 'IncreaseColumnLengthsForEncryption1742794800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Update user_addresses table - increase lengths for encrypted fields
    await queryRunner.query(`
      ALTER TABLE user_addresses 
      MODIFY COLUMN full_name VARCHAR(500) NOT NULL,
      MODIFY COLUMN email VARCHAR(500) NULL,
      MODIFY COLUMN phone VARCHAR(500) NOT NULL,
      MODIFY COLUMN address_line1 VARCHAR(1000) NOT NULL,
      MODIFY COLUMN address_line2 VARCHAR(1000) NULL,
      MODIFY COLUMN city VARCHAR(500) NULL,
      MODIFY COLUMN district VARCHAR(500) NOT NULL,
      MODIFY COLUMN province VARCHAR(500) NOT NULL,
      MODIFY COLUMN postal_code VARCHAR(500) NOT NULL;
    `);

    // Update banks table - increase lengths for encrypted fields
    await queryRunner.query(`
      ALTER TABLE banks 
      MODIFY COLUMN bank_name VARCHAR(500) NOT NULL,
      MODIFY COLUMN branch VARCHAR(500) NOT NULL,
      MODIFY COLUMN account_number VARCHAR(500) NOT NULL,
      MODIFY COLUMN account_name VARCHAR(500) NOT NULL;
    `);

    // Update payments table - increase length for encrypted reference_number
    await queryRunner.query(`
      ALTER TABLE payments 
      MODIFY COLUMN reference_number VARCHAR(1000) NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert user_addresses table
    await queryRunner.query(`
      ALTER TABLE user_addresses 
      MODIFY COLUMN full_name VARCHAR(200) NOT NULL,
      MODIFY COLUMN email VARCHAR(255) NULL,
      MODIFY COLUMN phone VARCHAR(20) NOT NULL,
      MODIFY COLUMN address_line1 VARCHAR(255) NOT NULL,
      MODIFY COLUMN address_line2 VARCHAR(255) NULL,
      MODIFY COLUMN city VARCHAR(100) NULL,
      MODIFY COLUMN district VARCHAR(100) NOT NULL,
      MODIFY COLUMN province VARCHAR(100) NOT NULL,
      MODIFY COLUMN postal_code VARCHAR(20) NOT NULL;
    `);

    // Revert banks table
    await queryRunner.query(`
      ALTER TABLE banks 
      MODIFY COLUMN bank_name VARCHAR(100) NOT NULL,
      MODIFY COLUMN branch VARCHAR(100) NOT NULL,
      MODIFY COLUMN account_number VARCHAR(50) NOT NULL,
      MODIFY COLUMN account_name VARCHAR(200) NOT NULL;
    `);

    // Revert payments table
    await queryRunner.query(`
      ALTER TABLE payments 
      MODIFY COLUMN reference_number VARCHAR(255) NULL;
    `);
  }
}
