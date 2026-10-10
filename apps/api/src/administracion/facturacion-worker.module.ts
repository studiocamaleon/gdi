import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { IntegracionesModule } from '../integraciones/integraciones.module';
import { FacturacionCoreModule } from './facturacion-core.module';
import { FacturacionLotesWorker } from './facturacion-lotes.worker';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    IntegracionesModule,
    FacturacionCoreModule,
  ],
  providers: [FacturacionLotesWorker],
})
export class FacturacionWorkerModule {}
