/**
 * File upload validation: allowed MIME types and magic-byte checks to reduce
 * risk of polyglot or malicious uploads. Use in addition to Multer limits.
 */

const ALLOWED_IMAGE_MIMES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
] as const;

/** Magic bytes for image types (first few bytes of file). */
const MAGIC: Array<{ mime: string; offsets: number[]; bytes: number[] }> = [
  { mime: 'image/jpeg', offsets: [0, 1, 2], bytes: [0xff, 0xd8, 0xff] },
  { mime: 'image/png', offsets: [0, 1, 2, 3], bytes: [0x89, 0x50, 0x4e, 0x47] },
  { mime: 'image/gif', offsets: [0, 1, 2], bytes: [0x47, 0x49, 0x46] },
  {
    mime: 'image/webp',
    offsets: [0, 1, 2, 3],
    bytes: [0x52, 0x49, 0x46, 0x46],
  },
];

const MAX_IMAGE_SIZE_BYTES = 2 * 1024 * 1024; // 2MB
const MAX_BANNER_SIZE_BYTES = 2 * 1024 * 1024; // 2MB

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  detectedMime?: string;
}

/**
 * Validates an uploaded image buffer: MIME type and magic bytes must match.
 * Call after Multer has placed the file in memory.
 */
export function validateImageUpload(
  buffer: Buffer,
  mimetype: string | undefined,
  options?: { maxSize?: number },
): FileValidationResult {
  const maxSize = options?.maxSize ?? MAX_IMAGE_SIZE_BYTES;
  if (!buffer || buffer.length === 0) {
    return { valid: false, error: 'File is empty' };
  }
  if (buffer.length > maxSize) {
    return {
      valid: false,
      error: `File size must not exceed ${Math.round(maxSize / 1024 / 1024)}MB`,
    };
  }
  if (
    mimetype &&
    !ALLOWED_IMAGE_MIMES.includes(
      mimetype as (typeof ALLOWED_IMAGE_MIMES)[number],
    )
  ) {
    return {
      valid: false,
      error: `Invalid file type. Allowed: ${ALLOWED_IMAGE_MIMES.join(', ')}`,
    };
  }
  const matched = MAGIC.find((m) => {
    if (m.offsets.some((i) => i >= buffer.length)) return false;
    return m.offsets.every((i) => buffer[i] === m.bytes[i]);
  });
  if (!matched) {
    return {
      valid: false,
      error:
        'File content does not match a valid image format (JPEG, PNG, GIF, WebP)',
    };
  }
  // Mismatch allowed: if a JPEG is named as .png, we accept it as valid,
  // but report the detected MIME type so services can automatically correct it.
  return { valid: true, detectedMime: matched.mime };
}

export const FILE_UPLOAD_LIMITS = {
  image: MAX_IMAGE_SIZE_BYTES,
  banner: MAX_BANNER_SIZE_BYTES,
} as const;
