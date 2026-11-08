import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { GroupsService } from './groups.service';
import { GroupsController } from './groups.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { ProductsModule } from '../products/products.module';
import { jwtConstants } from '../auth/jwt.strategy';

@Module({
  imports: [
    PrismaModule,
    ProductsModule,
    JwtModule.register({
      secret: jwtConstants.secret,
      signOptions: { expiresIn: '24h' },
    }),
  ],
  providers: [GroupsService],
  controllers: [GroupsController],
  exports: [GroupsService],
})
export class GroupsModule {}
