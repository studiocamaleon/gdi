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
import { EquipoService } from './equipo.service';
import { EmbudoService } from './embudo.service';
import { CostoLaboralService } from './costo-laboral.service';
import { EmpleadosModule } from '../empleados/empleados.module';

@Module({
  // El costo laboral sale del legajo: la remuneración vigente de cada persona.
  imports: [EmpleadosModule],
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
    EquipoService,
    EmbudoService,
    CostoLaboralService,
  ],
})
export class ReportesModule {}
