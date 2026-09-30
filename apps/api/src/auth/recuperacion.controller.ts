import { normalizarIp } from './ip';
import { PermitirEnrolamientoPlataforma } from './enrolamiento-plataforma';
import { Body, Controller, Get, Header, Ip, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { SinTenant } from '../common/sin-tenant.decorator';
import { PermitirSuscripcionInactiva } from '../suscripciones/permitir-suscripcion-inactiva.decorator';
import { CurrentSession } from './current-auth.decorator';
import type { CurrentAuth } from './auth.types';
import { SoloAutenticado } from './permiso.decorator';
import { ProhibidoImpersonando } from './prohibido-impersonando.decorator';
import { Public } from './public.decorator';
import { ClavePerfilDto } from './dto/perfil.dto';
import { RecuperacionService } from './recuperacion.service';

class SolicitarDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(254)
  email: string;
}
class TokenDto {
  @IsString() @Matches(/^[a-f0-9]{64}$/) token: string;
}
class RestablecerDto extends TokenDto {
  @IsString() @MinLength(8) @MaxLength(72) nueva: string;
}
@Controller('auth/recuperacion')
@SinTenant()
@PermitirSuscripcionInactiva()
@ProhibidoImpersonando()
export class RecuperacionController {
  constructor(private readonly recuperacion: RecuperacionService) {}
  @PermitirEnrolamientoPlataforma()
  @Get('estado')
  @SoloAutenticado()
  @Header('Cache-Control', 'private, no-store')
  estado(@CurrentSession() auth: CurrentAuth) {
    return this.recuperacion.estado(auth);
  }
  @Post('solicitar')
  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Header('Cache-Control', 'private, no-store')
  solicitar(@Body() dto: SolicitarDto, @Ip() ip: string) {
    return this.recuperacion.solicitar(dto.email, normalizarIp(ip));
  }
  @Post('verificar/solicitar')
  @SoloAutenticado()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Header('Cache-Control', 'private, no-store')
  pedirVerificacion(
    @CurrentSession() auth: CurrentAuth,
    @Body() dto: ClavePerfilDto,
    @Ip() ip: string,
  ) {
    return this.recuperacion.pedirVerificacion(
      auth,
      dto.password,
      normalizarIp(ip),
    );
  }
  @Post('verificar')
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Header('Cache-Control', 'private, no-store')
  verificar(@Body() dto: TokenDto, @Ip() ip: string) {
    return this.recuperacion.confirmar(
      dto.token,
      'verificar',
      normalizarIp(ip),
    );
  }
  @Post('restablecer')
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Header('Cache-Control', 'private, no-store')
  restablecer(@Body() dto: RestablecerDto, @Ip() ip: string) {
    return this.recuperacion.confirmar(
      dto.token,
      'restablecer',
      normalizarIp(ip),
      dto.nueva,
    );
  }
}
