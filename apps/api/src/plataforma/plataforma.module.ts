import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PlataformaController } from './plataforma.controller';
import { PlataformaAdminGuard } from './plataforma-admin.guard';
import { PlataformaGuard } from './plataforma.guard';
import { PlataformaService } from './plataforma.service';

/**
 * Control plane (etapa A): la consola de la Plataforma, sólo lectura.
 * Ver docs/control-plane-diseno.md
 */
@Module({
  imports: [PrismaModule],
  controllers: [PlataformaController],
  providers: [PlataformaService, PlataformaGuard, PlataformaAdminGuard],
})
export class PlataformaModule {}
