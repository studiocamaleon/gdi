import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../prisma/prisma.module';
import { CapacidadesEmpresaModule } from '../../../suscripciones/capacidades-empresa.module';
import { StorageModule } from '../../../archivos/storage/storage.module';
import { InboxTiempoRealModule } from '../../../inbox-tiempo-real/inbox-tiempo-real.module';
import { SecretosService } from '../../cripto/secretos.service';
import { MetaMediaClient } from './meta-media.client';
import { MetaAdjuntosService } from './meta-adjuntos.service';
@Module({
  imports: [
    PrismaModule,
    CapacidadesEmpresaModule,
    StorageModule,
    InboxTiempoRealModule,
  ],
  providers: [SecretosService, MetaMediaClient, MetaAdjuntosService],
  exports: [MetaAdjuntosService],
})
export class MetaAdjuntosModule {}
