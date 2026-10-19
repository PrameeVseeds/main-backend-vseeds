import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { validate } from './config/env.validation';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { PrivilegesGuard } from './common/guards/privileges.guard';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { RequestIdInterceptor } from './common/interceptors/request-id.interceptor';
import { ActivityLoggingInterceptor } from './modules/activity-logs/activity-logging.interceptor';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { AdminsModule } from './modules/admins/admins.module';
import { RolesModule } from './modules/roles/roles.module';
import { HealthModule } from './modules/health/health.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { ProductsModule } from './modules/products/products.module';
import { ImagesModule } from './modules/images/images.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { InvoiceTemplatesModule } from './modules/invoice-templates/invoice-templates.module';
import { DeliveriesModule } from './modules/deliveries/deliveries.module';
import { WishlistsModule } from './modules/wishlists/wishlists.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { QuotesModule } from './modules/quotes/quotes.module';
import { ContactsModule } from './modules/contacts/contacts.module';
import { BlogsModule } from './modules/blogs/blogs.module';
import { FaqsModule } from './modules/faqs/faqs.module';
import { BannersModule } from './modules/banners/banners.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { StatisticsModule } from './modules/statistics/statistics.module';
import { ActivityLogsModule } from './modules/activity-logs/activity-logs.module';
import { EmailTemplatesModule } from './modules/email-templates/email-templates.module';
import { SettingsModule } from './modules/settings/settings.module';
import { DatabaseModule } from './modules/database/database.module';
import { EmailModule } from './modules/email/email.module';
import { TokenBlacklistModule } from './common/services/token-blacklist.module';
import { RedisCacheModule } from './common/services/redis-cache.module';
import { BanksModule } from './modules/banks/banks.module';
import { PromoCodesModule } from './modules/promo-codes/promo-codes.module';
import { EncryptionModule } from './common/modules/encryption.module';
import { SentryModule } from './common/monitoring/sentry.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    AuthModule,
    UsersModule,
    AdminsModule,
    RolesModule,
    CategoriesModule,
    ProductsModule,
    ImagesModule,
    OrdersModule,
    PaymentsModule,
    InvoicesModule,
    InvoiceTemplatesModule,
    DeliveriesModule,
    WishlistsModule,
    ReviewsModule,
    QuotesModule,
    ContactsModule,
    BlogsModule,
    FaqsModule,
    BannersModule,
    ProjectsModule,
    StatisticsModule,
    ActivityLogsModule,
    EmailTemplatesModule,
    SettingsModule,
    DatabaseModule,
    EmailModule,
    HealthModule,
    TokenBlacklistModule,
    RedisCacheModule,
    BanksModule,
    PromoCodesModule,
    EncryptionModule,
    SentryModule,
    PrismaModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PrivilegesGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: RequestIdInterceptor },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    { provide: APP_INTERCEPTOR, useClass: ActivityLoggingInterceptor },
  ],
})
export class AppModule {}
