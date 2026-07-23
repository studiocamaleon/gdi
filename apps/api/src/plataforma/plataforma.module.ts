import { Module } from '@nestjs/common';
import { AdministracionModule } from '../administracion/administracion.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PlataformaBillingService } from './plataforma-billing.service';
import { PlataformaController } from './plataforma.controller';
import { PlataformaAdminGuard } from './plataforma-admin.guard';
import { PlataformaGuard } from './plataforma.guard';
import { PlataformaService } from './plataforma.service';

/**
 * Control plane (etapa A): la consola de la Plataforma, sólo lectura.
 * Ver docs/control-plane-diseno.md
 */
@Module({
  imports: [PrismaModule, AdministracionModule],
  controllers: [PlataformaController],
  providers: [
    PlataformaService,
    PlataformaBillingService,
    PlataformaGuard,
    PlataformaAdminGuard,
  ],
})
export class PlataformaModule {}
