import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CapacidadesEmpresaService } from './capacidades-empresa.service';
import { CapacidadGuard } from './capacidad.guard';
import { CapacidadesController } from './capacidades.controller';

@Module({
  imports: [PrismaModule],
  controllers: [CapacidadesController],
  providers: [CapacidadesEmpresaService, CapacidadGuard],
  exports: [CapacidadesEmpresaService, CapacidadGuard],
})
export class CapacidadesEmpresaModule {}
