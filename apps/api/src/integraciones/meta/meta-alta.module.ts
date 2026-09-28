import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { CapacidadesEmpresaModule } from '../../suscripciones/capacidades-empresa.module';
import { SecretosService } from '../cripto/secretos.service';
import { MetaConexionClient } from './meta-conexion.client';
import { MetaConexionService } from './meta-conexion.service';
import { MetaAltaService } from './meta-alta.service';

@Module({
  imports: [PrismaModule, CapacidadesEmpresaModule],
  providers: [
    SecretosService,
    MetaConexionClient,
    MetaConexionService,
    MetaAltaService,
  ],
  exports: [MetaConexionService, MetaAltaService, SecretosService],
})
export class MetaAltaModule {}
