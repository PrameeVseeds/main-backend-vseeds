import { Module } from '@nestjs/common';
import * as Sentry from '@sentry/node';

@Module({
  providers: [],
  exports: [],
})
export class SentryModule {
  constructor() {
    if (process.env.SENTRY_DSN) {
      Sentry.init({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.NODE_ENV || 'development',
        tracesSampleRate: 0.1,
        beforeSend(event: Sentry.ErrorEvent) {
          // Filter out sensitive information
          const request = event.request;
          if (request && request.headers) {
            delete request.headers['authorization'];
            delete request.headers['cookie'];
          }
          return event;
        },
      });
    }
  }
}
