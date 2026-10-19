import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PantallasProduccionService } from './pantallas-produccion.service';
import {
  DispositivoProduccionController,
  PantallasProduccionController,
} from './pantallas-produccion.controller';

@Module({
  imports: [PrismaModule],
  controllers: [DispositivoProduccionController, PantallasProduccionController],
  providers: [PantallasProduccionService],
})
export class PantallasProduccionModule {}
