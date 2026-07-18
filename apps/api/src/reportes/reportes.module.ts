import { Module } from '@nestjs/common';
import { ReportesController } from './reportes.controller';
import { ReportesService } from './reportes.service';
import { RentabilidadService } from './rentabilidad.service';
import { CobranzaService } from './cobranza.service';

@Module({
  controllers: [ReportesController],
  providers: [ReportesService, RentabilidadService, CobranzaService],
})
export class ReportesModule {}
