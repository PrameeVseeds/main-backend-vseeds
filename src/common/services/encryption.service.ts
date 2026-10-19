import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

export interface EncryptedData {
  keyId: string;
  iv: string;
  authTag: string;
  data: string;
}

@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly algorithm = 'aes-256-gcm';
  private readonly ivLength = 16;
  private readonly authTagLength = 16;
  private readonly keyId: string;
  private readonly encryptionKey: Buffer;

  constructor(private readonly configService: ConfigService) {
    const keyBase64 = this.configService.get<string>('ENCRYPTION_KEY');
    this.keyId = this.configService.get<string>('ENCRYPTION_KEY_ID', 'v1');

    if (!keyBase64) {
      this.logger.error(
        'ENCRYPTION_KEY not configured in environment variables',
      );
      throw new Error('Encryption key not configured');
    }

    try {
      this.encryptionKey = Buffer.from(keyBase64, 'base64');
      if (this.encryptionKey.length !== 32) {
        throw new Error(
          `Invalid key length: ${this.encryptionKey.length} bytes, expected 32 bytes`,
        );
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to initialize encryption key', errMsg);
      throw new Error('Invalid encryption key format');
    }

    this.logger.log(`EncryptionService initialized with keyId: ${this.keyId}`);
  }

  /**
   * Encrypt plain text using AES-256-GCM
   * Returns a formatted string: ENC:<keyId>:<base64(iv)>:<base64(authTag)>:<base64(encryptedData)>
   */
  encrypt(plainText: string): string {
    if (!plainText) {
      return plainText;
    }

    try {
      const iv = randomBytes(this.ivLength);
      const cipher = createCipheriv(this.algorithm, this.encryptionKey, iv);

      let encrypted = cipher.update(plainText, 'utf8', 'base64');
      encrypted += cipher.final('base64');

      const authTag = cipher.getAuthTag();

      const encryptedData: EncryptedData = {
        keyId: this.keyId,
        iv: iv.toString('base64'),
        authTag: authTag.toString('base64'),
        data: encrypted,
      };

      // Format: ENC:<keyId>:<iv>:<authTag>:<data>
      return `ENC:${encryptedData.keyId}:${encryptedData.iv}:${encryptedData.authTag}:${encryptedData.data}`;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      this.logger.error('Encryption failed', errMsg);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt legacy 4-part ciphertext (AES-256-CBC)
   * Format: ENC:<keyId>:<base64(iv)>:<base64(encryptedData)>
   */
  private decryptLegacyCbc(ivBase64: string, data: string): string {
    const iv = Buffer.from(ivBase64, 'base64');
    if (iv.length !== this.ivLength) {
      throw new Error(`Invalid IV length: ${iv.length} bytes`);
    }

    const decipher = createDecipheriv('aes-256-cbc', this.encryptionKey, iv);
    let decrypted = decipher.update(data, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  /**
   * Decrypt cipher text using AES-256-GCM
   * Expects format: ENC:<keyId>:<base64(iv)>:<base64(authTag)>:<base64(encryptedData)>
   * Also supports legacy format: ENC:<keyId>:<base64(iv)>:<base64(encryptedData)>
   * Returns plain text or original value if not encrypted
   */
  decrypt(cipherText: string): string {
    if (!cipherText || !this.isEncrypted(cipherText)) {
      return cipherText;
    }

    try {
      const parts = cipherText.split(':');
      if (parts.length === 5) {
        const [, keyId, ivBase64, authTagBase64, data] = parts;

        // TODO: Support key rotation by looking up key by keyId
        if (keyId !== this.keyId) {
          this.logger.warn(
            `Key ID mismatch: expected ${this.keyId}, got ${keyId}`,
          );
          // For now, try with current key (will fail if key was rotated)
        }

        const iv = Buffer.from(ivBase64, 'base64');
        const authTag = Buffer.from(authTagBase64, 'base64');

        if (iv.length !== this.ivLength) {
          throw new Error(`Invalid IV length: ${iv.length} bytes`);
        }

        if (authTag.length !== this.authTagLength) {
          throw new Error(`Invalid auth tag length: ${authTag.length} bytes`);
        }

        const decipher = createDecipheriv(this.algorithm, this.encryptionKey, iv);
        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(data, 'base64', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
      } else if (parts.length === 4) {
        const [, , ivBase64, data] = parts;
        return this.decryptLegacyCbc(ivBase64, data);
      } else {
        this.logger.error('Invalid encrypted data format');
        throw new Error('Invalid encrypted data format');
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      this.logger.error('Decryption failed', errMsg);
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Check if a value is encrypted (has ENC: prefix)
   */
  isEncrypted(value: string): boolean {
    return typeof value === 'string' && value.startsWith('ENC:');
  }

  /**
   * Generate a new encryption key (for initial setup or key rotation)
   * Returns base64 encoded 32-byte key
   */
  static generateKey(): string {
    return randomBytes(32).toString('base64');
  }
}
