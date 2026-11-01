import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TenantsService } from './tenants.service';
import { TenantsController } from './tenants.controller';
import { LeadgerWebhookService } from './leadger-webhook.service';
import { PrismaModule } from '../prisma/prisma.module';
import { jwtConstants } from '../auth/jwt.strategy';

@Module({
  imports: [
    PrismaModule,
    JwtModule.register({
      secret: jwtConstants.secret,
      signOptions: { expiresIn: '24h' },
    }),
  ],
  providers: [TenantsService, LeadgerWebhookService],
  controllers: [TenantsController],
  exports: [TenantsService, LeadgerWebhookService],
})
export class TenantsModule {}
