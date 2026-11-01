import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CrediarioController } from './crediario.controller';
import { CrediarioService } from './crediario.service';
import { WhatsappBaileysService } from './whatsapp-baileys.service';
import { CrediarioCronService } from './crediario-cron.service';

@Module({
  imports: [PrismaModule],
  controllers: [CrediarioController],
  providers: [
    CrediarioService,
    WhatsappBaileysService,
    CrediarioCronService,
  ],
  exports: [CrediarioService, WhatsappBaileysService],
})
export class CrediarioModule {}
