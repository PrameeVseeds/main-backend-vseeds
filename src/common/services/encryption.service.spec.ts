import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EncryptionService } from './encryption.service';

describe('EncryptionService', () => {
  let service: EncryptionService;
  const testKey = Buffer.from('test-key-32-chars-long-for-test!').toString(
    'base64',
  );

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EncryptionService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'ENCRYPTION_KEY') return testKey;
              if (key === 'ENCRYPTION_KEY_ID') return 'test-v1';
              return null;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<EncryptionService>(EncryptionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('encrypt', () => {
    it('should encrypt plain text successfully', () => {
      const plainText = 'Hello World';
      const encrypted = service.encrypt(plainText);

      expect(encrypted).toBeDefined();
      expect(encrypted).not.toEqual(plainText);
      expect(encrypted).toMatch(/^ENC:/);
    });

    it('should return empty/undefined values as-is', () => {
      expect(service.encrypt('')).toBe('');
      expect(service.encrypt(null as any)).toBe(null);
      expect(service.encrypt(undefined as any)).toBe(undefined);
    });

    it('should produce different outputs for same input (due to random IV)', () => {
      const plainText = 'Same Text';
      const encrypted1 = service.encrypt(plainText);
      const encrypted2 = service.encrypt(plainText);

      expect(encrypted1).not.toEqual(encrypted2);
    });

    it('should encrypt unicode characters correctly', () => {
      const plainText = 'Hello 世界 🌍 ñ ó';
      const encrypted = service.encrypt(plainText);
      const decrypted = service.decrypt(encrypted);

      expect(decrypted).toEqual(plainText);
    });

    it('should encrypt long text correctly', () => {
      const plainText = 'a'.repeat(10000);
      const encrypted = service.encrypt(plainText);
      const decrypted = service.decrypt(encrypted);

      expect(decrypted).toEqual(plainText);
    });
  });

  describe('decrypt', () => {
    it('should decrypt encrypted text back to original', () => {
      const plainText = 'Secret Message';
      const encrypted = service.encrypt(plainText);
      const decrypted = service.decrypt(encrypted);

      expect(decrypted).toEqual(plainText);
    });

    it('should return non-encrypted values as-is', () => {
      const plainText = 'Not Encrypted';
      expect(service.decrypt(plainText)).toEqual(plainText);
    });

    it('should return null/undefined as-is', () => {
      expect(service.decrypt(null as any)).toBe(null);
      expect(service.decrypt(undefined as any)).toBe(undefined);
      expect(service.decrypt('')).toBe('');
    });

    it('should throw error for invalid encrypted format', () => {
      expect(() => service.decrypt('ENC:invalid')).toThrow();
    });

    it('should throw error for tampered encrypted data', () => {
      const plainText = 'Important Data';
      const encrypted = service.encrypt(plainText);
      const tampered = encrypted.slice(0, -5) + 'XXXXX';

      expect(() => service.decrypt(tampered)).toThrow();
    });
  });

  describe('isEncrypted', () => {
    it('should return true for encrypted values', () => {
      const encrypted = service.encrypt('test');
      expect(service.isEncrypted(encrypted)).toBe(true);
    });

    it('should return false for plain text', () => {
      expect(service.isEncrypted('plain text')).toBe(false);
      expect(service.isEncrypted('')).toBe(false);
    });

    it('should return false for null/undefined', () => {
      expect(service.isEncrypted(null as any)).toBe(false);
      expect(service.isEncrypted(undefined as any)).toBe(false);
    });
  });

  describe('generateKey', () => {
    it('should generate a valid base64 encoded 32-byte key', () => {
      const key = EncryptionService.generateKey();
      const decoded = Buffer.from(key, 'base64');

      expect(decoded.length).toBe(32);
      expect(key).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
    });

    it('should generate different keys each time', () => {
      const key1 = EncryptionService.generateKey();
      const key2 = EncryptionService.generateKey();

      expect(key1).not.toEqual(key2);
    });
  });

  describe('encryption format', () => {
    it('should have correct format: ENC:keyId:iv:authTag:data', () => {
      const plainText = 'Test';
      const encrypted = service.encrypt(plainText);
      const parts = encrypted.split(':');

      expect(parts.length).toBe(5);
      expect(parts[0]).toBe('ENC');
      expect(parts[1]).toBe('test-v1');
      // parts[2] = IV (base64)
      // parts[3] = authTag (base64)
      // parts[4] = encrypted data (base64)
    });
  });
});
