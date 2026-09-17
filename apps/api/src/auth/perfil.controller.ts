import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Patch,
  Post,
  Put,
  Res,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { SinTenant } from '../common/sin-tenant.decorator';
import { PermitirSuscripcionInactiva } from '../suscripciones/permitir-suscripcion-inactiva.decorator';
import { SoloAutenticado } from './permiso.decorator';
import { ProhibidoImpersonando } from './prohibido-impersonando.decorator';
import { CurrentSession } from './current-auth.decorator';
import type { CurrentAuth } from './auth.types';
import { PerfilService } from './perfil.service';
import { MfaService } from './mfa.service';
import {
  ClavePerfilDto,
  ConfirmarMfaDto,
  EditarPerfilDto,
  FotoPerfilDto,
  GestionMfaDto,
} from './dto/perfil.dto';

@Controller('auth/perfil')
@SoloAutenticado()
@SinTenant()
@ProhibidoImpersonando()
@PermitirSuscripcionInactiva()
export class PerfilController {
  constructor(
    private readonly perfil: PerfilService,
    private readonly mfa: MfaService,
  ) {}

  @Patch()
  editar(@CurrentSession() auth: CurrentAuth, @Body() dto: EditarPerfilDto) {
    return this.perfil.editar(auth, dto.nombreCompleto);
  }

  @Put('foto')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  foto(@CurrentSession() auth: CurrentAuth, @Body() dto: FotoPerfilDto) {
    return this.perfil.guardarFoto(auth, dto.contenido);
  }

  @Delete('foto')
  quitar(@CurrentSession() auth: CurrentAuth) {
    return this.perfil.quitarFoto(auth);
  }

  @Get('foto')
  async descargar(@CurrentSession() auth: CurrentAuth, @Res() res: Response) {
    res.setHeader('Cache-Control', 'private, no-store');
    res.redirect(302, await this.perfil.urlFoto(auth));
  }

  @Get('mfa')
  @Header('Cache-Control', 'no-store')
  estado(@CurrentSession() auth: CurrentAuth) {
    return this.mfa.estado(auth);
  }

  @Post('mfa/iniciar')
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  iniciar(@CurrentSession() auth: CurrentAuth, @Body() dto: ClavePerfilDto) {
    return this.mfa.iniciar(auth, dto.password);
  }

  @Post('mfa/confirmar')
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  confirmar(@CurrentSession() auth: CurrentAuth, @Body() dto: ConfirmarMfaDto) {
    return this.mfa.confirmar(auth, dto.setupId, dto.codigo);
  }

  @Delete('mfa/pendiente')
  cancelar(@CurrentSession() auth: CurrentAuth) {
    return this.mfa.cancelar(auth);
  }

  @Post('mfa/desactivar')
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  desactivar(@CurrentSession() auth: CurrentAuth, @Body() dto: GestionMfaDto) {
    return this.mfa.gestionar(auth, dto.password, dto.codigo, 'desactivar');
  }

  @Post('mfa/recuperacion')
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  recuperar(@CurrentSession() auth: CurrentAuth, @Body() dto: GestionMfaDto) {
    return this.mfa.gestionar(auth, dto.password, dto.codigo, 'regenerar');
  }
}
