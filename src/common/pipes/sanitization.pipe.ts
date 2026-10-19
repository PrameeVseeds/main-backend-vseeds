import { PipeTransform, Injectable, ArgumentMetadata } from '@nestjs/common';

@Injectable()
export class SanitizationPipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    if (metadata.type === 'body' && value && typeof value === 'object') {
      return this.sanitizeObject(value);
    }
    return value;
  }

  private sanitizeObject(obj: unknown): unknown {
    if (Array.isArray(obj)) {
      return obj.map((item: unknown) => this.sanitizeObject(item));
    }
    if (obj && typeof obj === 'object') {
      const record = obj as Record<string, unknown>;
      const sanitized: Record<string, unknown> = {};
      for (const key of Object.keys(record)) {
        const val = record[key];
        if (typeof val === 'string') {
          sanitized[key] = this.sanitizeString(key, val);
        } else if (typeof val === 'object' && val !== null) {
          sanitized[key] = this.sanitizeObject(val);
        } else {
          sanitized[key] = val;
        }
      }
      return sanitized;
    }
    return obj;
  }

  private sanitizeString(key: string, val: string): string {
    // List of rich text fields that should preserve safe HTML formatting tags
    const richTextFields = [
      'content',
      'htmlBody',
      'html',
      'description',
      'specifications',
    ];

    if (richTextFields.includes(key)) {
      // Strip script tags and dynamic inline javascript handlers (e.g. onload, onerror)
      return val
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/on\w+\s*=\s*(['"])(.*?)\1/gi, '');
    }

    // Strip all HTML tags entirely for standard string inputs
    return val.replace(/<[^>]*>/g, '');
  }
}
