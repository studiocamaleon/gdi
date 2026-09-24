import { CapacidadesEmpresaModule } from '../suscripciones/capacidades-empresa.module';
import { Module } from '@nestjs/common';
import { ArchivosModule } from '../archivos/archivos.module';
import { EnlacesPublicosModule } from '../enlaces-publicos/enlaces-publicos.module';
import { OrdenesTrabajoModule } from '../ordenes-trabajo/ordenes-trabajo.module';
import { DatosEmpresaModule } from '../tenants/datos-empresa.module';
import { CuponesModule } from '../cupones/cupones.module';
import { PresupuestosController } from './presupuestos.controller';
import { PresupuestosService } from './presupuestos.service';
import { PresupuestoPdfService } from './presupuesto-pdf.service';
import { PresupuestoRenderService } from './pdf-piloto/presupuesto-render.service';
import { PresupuestoPilotoService } from './pdf-piloto/presupuesto-piloto.service';
import { DocumentosPdfModule } from '../documentos-pdf/documentos-pdf.module';
import { CorreoPresupuestoService } from './correo-presupuesto.service';
import { CorreoPresupuestoTransporte } from './correo-presupuesto.transporte';

@Module({
  imports: [CapacidadesEmpresaModule,
    DocumentosPdfModule,
    OrdenesTrabajoModule,
    ArchivosModule,
    EnlacesPublicosModule,
    DatosEmpresaModule,
    CuponesModule,
  ],
  controllers: [PresupuestosController],
  providers: [
    PresupuestosService,
    PresupuestoPdfService,
    PresupuestoRenderService,
    PresupuestoPilotoService,
    CorreoPresupuestoService,
    CorreoPresupuestoTransporte,
  ],
})
export class PresupuestosModule {}
