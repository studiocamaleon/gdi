import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SessionCacheService } from './session-cache.service';
import { SesionesScheduler } from './sesiones.scheduler';
import { MfaService } from './mfa.service';
import { PerfilService } from './perfil.service';
import { PerfilController } from './perfil.controller';
import { StorageModule } from '../archivos/storage/storage.module';
import { SecretosService } from '../integraciones/cripto/secretos.service';

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  throw new Error('JWT_SECRET environment variable is not set');
}
// En producción, rechazar secretos débiles o de desarrollo.
if (
  process.env.NODE_ENV === 'production' &&
  (jwtSecret.startsWith('gdi-dev-') || jwtSecret.length < 32)
) {
  throw new Error(
    'JWT_SECRET inseguro en producción: usá un secreto aleatorio de al menos 32 caracteres (p. ej. `openssl rand -base64 48`).',
  );
}

@Module({
  imports: [
    StorageModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET,
    }),
  ],
  controllers: [AuthController, PerfilController],
  providers: [
    AuthService,
    SessionCacheService,
    SesionesScheduler,
    MfaService,
    PerfilService,
    SecretosService,
  ],
  exports: [AuthService, SessionCacheService, JwtModule],
})
export class AuthModule {}
