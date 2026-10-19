import 'reflect-metadata';

export const ENCRYPTED_METADATA_KEY = 'encrypted:fields';

/**
 * Decorator to mark entity fields for automatic encryption/decryption
 * Must be used in combination with @Column decorator from TypeORM
 *
 * Example:
 * @Encrypted()
 * @Column({ length: 500 })
 * phone: string;
 */
export function Encrypted(): PropertyDecorator {
  return (target: object, propertyKey: string | symbol) => {
    const existingFields =
      (Reflect.getMetadata(ENCRYPTED_METADATA_KEY, target) as
        | Array<string | symbol>
        | undefined) || [];
    const fields = [...existingFields, propertyKey];
    Reflect.defineMetadata(ENCRYPTED_METADATA_KEY, fields, target);
  };
}

/**
 * Get all encrypted field names for an entity class
 */
export function getEncryptedFields(target: object): string[] {
  return (
    (Reflect.getMetadata(ENCRYPTED_METADATA_KEY, target) as
      | string[]
      | undefined) || []
  );
}

/**
 * Check if a field is marked for encryption
 */
export function isEncryptedField(
  target: object,
  propertyKey: string | symbol,
): boolean {
  const fields = getEncryptedFields(target);
  return fields.includes(propertyKey as string);
}
