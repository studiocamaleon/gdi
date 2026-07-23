import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EnlacesPublicosService } from './enlaces-publicos.service';

@Module({
  imports: [PrismaModule],
  providers: [EnlacesPublicosService],
  exports: [EnlacesPublicosService],
})
export class EnlacesPublicosModule {}
