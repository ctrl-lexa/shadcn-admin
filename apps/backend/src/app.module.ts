import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { CommonModule } from './common/common.module';
import { AuthModule } from './auth/auth.module';
import { TestModule } from './test/test.module';
import { UsersModule } from './users/users.module';
import { OutletsModule } from './outlets/outlets.module';
import { ProductsModule } from './products/products.module';
import { TransactionsModule } from './transactions/transactions.module';
import { AuditLogsModule } from './audit-logs/audit-logs.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { PermissionsGuard } from './auth/guards/permissions.guard';
import { RolesGuard } from './auth/guards/roles.guard';

@Module({
  imports: [
    PrismaModule,
    CommonModule,
    AuthModule,
    TestModule,
    UsersModule,
    OutletsModule,
    ProductsModule,
    TransactionsModule,
    AuditLogsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Apply JWT Auth globally
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    // Apply Permissions Guard globally (after JWT)
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
    // Apply Roles Guard globally (after JWT)
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
