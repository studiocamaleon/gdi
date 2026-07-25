import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { SuscripcionesModule } from '../suscripciones/suscripciones.module';
import { UsuariosController } from './usuarios.controller';
import { UsuariosService } from './usuarios.service';

/**
 * Usuarios y roles del tenant. Depende de Suscripciones por el tope de
 * `usuariosMax` del plan y por saber qué módulos incluye.
 */
@Module({
  imports: [PrismaModule, AuthModule, SuscripcionesModule],
  controllers: [UsuariosController],
  providers: [UsuariosService],
  exports: [UsuariosService],
})
export class UsuariosModule {}
