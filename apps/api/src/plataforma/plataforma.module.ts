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

/**
 * Control plane (etapa A): la consola de la Plataforma, sólo lectura.
 * Ver docs/control-plane-diseno.md
 */
@Module({
  imports: [PrismaModule, AuthModule, CobroModule],
  controllers: [PlataformaController],
  providers: [
    PlataformaService,
    ImpersonacionService,
    NegocioService,
    PlataformaGuard,
    PlataformaAdminGuard,
  ],
})
export class PlataformaModule {}
