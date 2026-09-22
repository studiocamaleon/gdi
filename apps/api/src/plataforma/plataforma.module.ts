import { PlanesPaddleService } from './planes/planes-paddle.service';
import { PlanesOfertasController } from './planes/planes-ofertas.controller';
import { PlanesOfertasService } from './planes/planes-ofertas.service';
import { Module } from '@nestjs/common';
import { ContratacionesPlataformaController } from './contrataciones-plataforma.controller';
import { ContratacionesPlataformaService } from './contrataciones-plataforma.service';
import { ConsultaContratacionService } from '../suscripciones/consulta-contratacion.service';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { CobroModule } from '../cobro/cobro.module';
import { ImpersonacionService } from './impersonacion.service';
import { NegocioService } from './negocio.service';
import { PlataformaController } from './plataforma.controller';
import { PlataformaAdminGuard } from './plataforma-admin.guard';
import { PlataformaGuard } from './plataforma.guard';
import { PlataformaService } from './plataforma.service';
import { ProvisionamientoModule } from '../provisionamiento/provisionamiento.module';
import { EmpresasPlataformaService } from './empresas.service';
import { EquipoPlataformaService } from './equipo.service';
import { EquipoPlataformaController } from './equipo.controller';
import { SuscripcionesPlataformaController } from './suscripciones-plataforma.controller';
import { SuscripcionesPlataformaService } from './suscripciones-plataforma.service';
import { PlanesBorradoresController } from './planes/planes-borradores.controller';
import { PlanesBorradoresService } from './planes/planes-borradores.service';
import { PlanesVersionesService } from './planes/planes-versiones.service';
import { PlanesAsignacionService } from './planes/planes-asignacion.service';
import { PlanesAsignacionController } from './planes/planes-asignacion.controller';
import { PlanesVersionesController } from './planes/planes-versiones.controller';
import { PlanesComparacionService } from './planes/planes-comparacion.service';
import { CapacidadesEmpresaModule } from '../suscripciones/capacidades-empresa.module';

/**
 * Control plane (etapa A): la consola de la Plataforma, sólo lectura.
 * Ver docs/control-plane-diseno.md
 */
@Module({
  imports: [
    PrismaModule,
    AuthModule,
    CobroModule,
    ProvisionamientoModule,
    CapacidadesEmpresaModule,
  ],
  controllers: [
    ContratacionesPlataformaController,
    PlanesOfertasController,
    PlanesAsignacionController,
    PlanesVersionesController,
    PlanesBorradoresController,
    PlataformaController,
    EquipoPlataformaController,
    SuscripcionesPlataformaController,
  ],
  providers: [
    ContratacionesPlataformaService,
    ConsultaContratacionService,
    PlanesOfertasService,
    PlanesPaddleService,
    PlanesAsignacionService,
    PlanesVersionesService,
    PlanesComparacionService,
    PlanesBorradoresService,
    SuscripcionesPlataformaService,
    EquipoPlataformaService,
    EmpresasPlataformaService,
    PlataformaService,
    ImpersonacionService,
    NegocioService,
    PlataformaGuard,
    PlataformaAdminGuard,
  ],
})
export class PlataformaModule {}
