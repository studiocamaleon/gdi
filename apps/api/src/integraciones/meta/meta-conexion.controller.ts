import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Post,
  Req,
  ServiceUnavailableException,
} from '@nestjs/common';
import { RolSistema } from '@prisma/client';
import {
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import type { Request } from 'express';
import type { CurrentAuth } from '../../auth/auth.types';
import { CurrentSession } from '../../auth/current-auth.decorator';
import { ipDeRequest } from '../../auth/ip';
import { Permiso } from '../../auth/permiso.decorator';
import { Roles } from '../../auth/roles.decorator';
import { ProhibidoImpersonando } from '../../auth/prohibido-impersonando.decorator';
import { modoAltaPermitido } from './meta-conexion.config';
import { MetaConexionService } from './meta-conexion.service';

export class PrepararMetaDto {}
export class IntentoMetaDto {
  @IsUUID('4') id!: string;
  @Matches(/^[A-Za-z0-9_-]{43}$/) estadoSecreto!: string;
}
export class CanjearMetaDto extends IntentoMetaDto {
  @IsString() @MinLength(1) @MaxLength(16384) codigo!: string;
}
export class VerificarMetaDto extends IntentoMetaDto {
  @Matches(/^\d{1,32}$/) wabaId!: string;
  @IsOptional() @Matches(/^\d{1,32}$/) phoneNumberId?: string;
}

@Controller('integraciones/meta/conexion')
@Roles(RolSistema.ADMINISTRADOR)
@Permiso("configuracion.integraciones.gestionar")
@ProhibidoImpersonando()
export class MetaConexionController {
  constructor(private readonly service: MetaConexionService) {}
  private habilitar(auth: CurrentAuth) {
    if (!modoAltaPermitido(auth.tenantId))
      throw new ServiceUnavailableException(
        'El alta de WhatsApp todavía no está habilitada para esta empresa.',
      );
  }
  @Get()
  @Header('Cache-Control', 'no-store')
  estado(@CurrentSession() auth: CurrentAuth, @Req() req: Request) {
    return this.service.estado(auth, ipDeRequest(req));
  }
  @Post('preparar')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  preparar(
    @CurrentSession() auth: CurrentAuth,
    @Req() req: Request,
    @Body() body: PrepararMetaDto,
  ) {
    void body; // Validación del DTO vacío: rechaza selectores de empresa del cliente.
    this.habilitar(auth);
    return this.service.preparar(auth, ipDeRequest(req));
  }
  // El secreto de continuidad sólo viaja en POST; nunca en una URL ni logs de acceso.
  @Post('consultar')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  consultar(
    @CurrentSession() auth: CurrentAuth,
    @Req() req: Request,
    @Body() body: IntentoMetaDto,
  ) {
    return this.service.consultar(auth, ipDeRequest(req), body);
  }
  @Post('canjear')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  canjear(
    @CurrentSession() auth: CurrentAuth,
    @Req() req: Request,
    @Body() body: CanjearMetaDto,
  ) {
    this.habilitar(auth);
    return this.service.canjear(auth, ipDeRequest(req), body, body.codigo);
  }
  @Post('verificar')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  verificar(
    @CurrentSession() auth: CurrentAuth,
    @Req() req: Request,
    @Body() body: VerificarMetaDto,
  ) {
    this.habilitar(auth);
    return this.service.verificar(auth, ipDeRequest(req), body, body);
  }
  @Post('cancelar')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  cancelar(
    @CurrentSession() auth: CurrentAuth,
    @Req() req: Request,
    @Body() body: IntentoMetaDto,
  ) {
    return this.service.cancelar(auth, ipDeRequest(req), body);
  }
}
