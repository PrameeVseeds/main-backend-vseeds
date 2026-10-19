import { Injectable, OnModuleInit } from '@nestjs/common';

@Injectable()
export class TokenBlacklistService implements OnModuleInit {
  private readonly blacklist = new Map<string, number>();

  onModuleInit() {
    setInterval(() => this.cleanup(), 15 * 60_000);
  }

  revoke(token: string, expiresInMs = 3 * 60 * 60_000): void {
    this.blacklist.set(token, Date.now() + expiresInMs);
  }

  isRevoked(token: string): boolean {
    const expiry = this.blacklist.get(token);
    if (expiry === undefined) return false;
    if (Date.now() > expiry) {
      this.blacklist.delete(token);
      return false;
    }
    return true;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [token, expiry] of this.blacklist) {
      if (now > expiry) this.blacklist.delete(token);
    }
  }
}
