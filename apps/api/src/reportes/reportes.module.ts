import { Module } from '@nestjs/common';
import { ReportesController } from './reportes.controller';
import { ReportesService } from './reportes.service';
import { RentabilidadService } from './rentabilidad.service';
import { CobranzaService } from './cobranza.service';
import { VentasService } from './ventas.service';
import { ProductoService } from './producto.service';
import { ReporteProduccionService } from './produccion.service';
import { AlertasService } from './alertas.service';
import { ClientesService } from './clientes.service';

@Module({
  controllers: [ReportesController],
  providers: [
    ReportesService,
    RentabilidadService,
    CobranzaService,
    VentasService,
    ProductoService,
    ReporteProduccionService,
    AlertasService,
    ClientesService,
  ],
})
export class ReportesModule {}
