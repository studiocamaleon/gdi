import { Module } from '@nestjs/common';
import { ReportesController } from './reportes.controller';
import { ReportesService } from './reportes.service';
import { RentabilidadService } from './rentabilidad.service';
import { CobranzaService } from './cobranza.service';
import { VentasService } from './ventas.service';
import { ProductoService } from './producto.service';

@Module({
  controllers: [ReportesController],
  providers: [
    ReportesService,
    RentabilidadService,
    CobranzaService,
    VentasService,
    ProductoService,
  ],
})
export class ReportesModule {}
