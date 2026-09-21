import { Module } from '@nestjs/common';
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
    PlanesBorradoresController,
    PlataformaController,
    EquipoPlataformaController,
    SuscripcionesPlataformaController,
  ],
  providers: [
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
