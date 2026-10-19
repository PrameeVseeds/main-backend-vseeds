import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { softDeleteExtension } from './prisma-soft-delete.extension';
import { encryptionExtension } from './prisma-encryption.extension';
import { historyExtension } from './prisma-history.extension';
import { EncryptionService } from '../common/services/encryption.service';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private readonly _client: any;
  private readonly _baseClient: PrismaClient;

  constructor(private readonly encryptionService: EncryptionService) {
    super({
      log: [
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'warn' },
      ],
    });

    this._baseClient = new PrismaClient({
      log: [
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'warn' },
      ],
    });

    this._client = this._baseClient
      .$extends(softDeleteExtension)
      .$extends(encryptionExtension(this.encryptionService))
      .$extends(historyExtension(this._baseClient));

    /* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call */
    // Return proxy to intercept all accesses and route them to the extended client.
    return new Proxy(this, {
      get: (target, prop) => {
        // Return service-only properties (logger, onModuleInit, _client, etc.) from the instance.
        // Model properties (invoice, user, order...) are also present on the base PrismaClient,
        // so prefer the extended client when the property exists there.
        if (prop in target && !(prop in target._client)) {
          const val = (target as any)[prop];
          if (typeof val === 'function') {
            return val.bind(target);
          }
          return val;
        }

        // Delegate to the extended client
        const val = target._client[prop];
        if (typeof val === 'function') {
          return val.bind(target._client);
        }
        return val;
      },
    });
    /* eslint-enable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call */
  }

  async onModuleInit() {
    await this._baseClient.$connect();
    await this.$connect();
    this.logger.log(
      'Prisma connected to database (with soft-delete, encryption & history)',
    );
  }

  async onModuleDestroy() {
    await this.$disconnect();
    await this._baseClient.$disconnect();
    this.logger.log('Prisma disconnected from database');
  }
}
