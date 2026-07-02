import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SessionCacheService } from './session-cache.service';

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
    JwtModule.register({
      secret: process.env.JWT_SECRET,
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, SessionCacheService],
  exports: [AuthService, SessionCacheService, JwtModule],
})
export class AuthModule {}
