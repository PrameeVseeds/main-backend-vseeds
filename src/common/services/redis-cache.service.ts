import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';

@Injectable()
export class RedisCacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisCacheService.name);
  private cache = new Map<string, { data: any; expiry: number }>();
  private defaultTTL = 3600; // 1 hour default TTL

  constructor() {
    this.logger.log('RedisCacheService initialized (In-Memory Cache fallback)');
  }

  onModuleInit() {
    this.logger.log('In-memory cache ready');
  }

  onModuleDestroy() {
    this.cache.clear();
    this.logger.log('In-memory cache cleared');
  }

  get<T>(key: string): Promise<T | null> {
    const cached = this.cache.get(key);
    if (!cached) return Promise.resolve(null);
    if (Date.now() > cached.expiry) {
      this.cache.delete(key);
      return Promise.resolve(null);
    }
    return Promise.resolve(cached.data as T);
  }

  set<T>(key: string, data: T, ttlMs?: number): Promise<void> {
    const ttl = ttlMs ?? this.defaultTTL;
    const expiry = Date.now() + ttl;
    this.cache.set(key, { data, expiry });
    return Promise.resolve();
  }

  delete(key: string): Promise<void> {
    this.cache.delete(key);
    return Promise.resolve();
  }

  clear(): Promise<void> {
    this.cache.clear();
    return Promise.resolve();
  }

  deletePattern(pattern: string): Promise<void> {
    const regexPattern = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    for (const key of this.cache.keys()) {
      if (regexPattern.test(key)) {
        this.cache.delete(key);
      }
    }
    return Promise.resolve();
  }

  exists(key: string): Promise<boolean> {
    const cached = this.cache.get(key);
    if (!cached) return Promise.resolve(false);
    if (Date.now() > cached.expiry) {
      this.cache.delete(key);
      return Promise.resolve(false);
    }
    return Promise.resolve(true);
  }

  setMany<T>(
    entries: Array<{ key: string; data: T; ttl?: number }>,
  ): Promise<void> {
    for (const entry of entries) {
      this.cache.set(entry.key, {
        data: entry.data,
        expiry: Date.now() + (entry.ttl ?? this.defaultTTL),
      });
    }
    return Promise.resolve();
  }

  getMany<T>(keys: string[]): Promise<Map<string, T>> {
    const result = new Map<string, T>();
    for (const key of keys) {
      const cached = this.cache.get(key);
      if (cached && Date.now() <= cached.expiry) {
        result.set(key, cached.data as T);
      }
    }
    return Promise.resolve(result);
  }
}
