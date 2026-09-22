import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Throttle } from '@nestjs/throttler';
import { SinTenant } from '../../common/sin-tenant.decorator';
import { CurrentSession } from '../../auth/current-auth.decorator';
import type { CurrentAuth } from '../../auth/auth.types';
import { PlataformaGuard } from '../plataforma.guard';
import { PlataformaAdminGuard } from '../plataforma-admin.guard';
import { PlanesPaddleService } from './planes-paddle.service';
import { PlanesOfertasService } from './planes-ofertas.service';
import type { CicloOferta, TipoPrecioOferta } from './ofertas-planes';

export class PrecioOfertaDto {
  @IsIn(['base', 'usuario', 'implementacion']) tipo: TipoPrecioOferta;
  @IsIn(['mensual', 'anual', 'unico']) ciclo: CicloOferta | 'unico';
  @Matches(/^pri_[a-z0-9]{26}$/) priceId: string;
}
export class ActivarOfertaDto {
  @IsUUID() versionId: string;
  @IsIn(['sandbox', 'production']) entorno: string;
  @IsInt() @Min(0) revision: number;
  @IsBoolean() registroPublico: boolean;
  @IsBoolean() recomendado: boolean;
  @IsOptional() @IsInt() @Min(1) @Max(90) trialDias: number | null;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => PrecioOfertaDto)
  precios: PrecioOfertaDto[];
  @IsString() @MinLength(5) @MaxLength(500) motivo: string;
}
export class SincronizarOfertaDto {
  @IsUUID() versionId: string;
  @IsIn(['sandbox', 'production']) entorno: string;
  @IsInt() @Min(0) revision: number;
  @IsBoolean() recomendado: boolean;
  @IsString() @MinLength(5) @MaxLength(500) motivo: string;
}
export class RetirarOfertaDto {
  @IsUUID() ofertaId: string;
  @IsInt() @Min(1) revision: number;
  @IsString() @MinLength(5) @MaxLength(500) motivo: string;
}
export class RetirarPlanAnteriorDto {
  @IsUUID() planId: string;
  @IsInt() @Min(0) revision: number;
  @IsString() @MinLength(5) @MaxLength(500) motivo: string;
}

@Controller('plataforma/planes-ofertas')
@SinTenant()
@UseGuards(PlataformaGuard)
export class PlanesOfertasController {
  constructor(
    private readonly ofertas: PlanesOfertasService,
    private readonly paddle: PlanesPaddleService,
  ) {}

  @Post('sincronizar')
  @UseGuards(PlataformaAdminGuard)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  sincronizar(
    @CurrentSession() auth: CurrentAuth,
    @Body() dto: SincronizarOfertaDto,
  ) {
    return this.paddle.sincronizar(auth, dto);
  }
  @Get('borrador/:id')
  @Header('Cache-Control', 'no-store')
  estado(@Param('id', ParseUUIDPipe) id: string) {
    return this.ofertas.estado(id);
  }

  @Post('activar')
  @UseGuards(PlataformaAdminGuard)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  activar(@CurrentSession() auth: CurrentAuth, @Body() dto: ActivarOfertaDto) {
    return this.ofertas.activar(auth, dto);
  }
  @Post('retirar')
  @UseGuards(PlataformaAdminGuard)
  retirar(@CurrentSession() auth: CurrentAuth, @Body() dto: RetirarOfertaDto) {
    return this.ofertas.retirar(auth, dto);
  }
  @Post('retirar-anterior')
  @UseGuards(PlataformaAdminGuard)
  retirarAnterior(
    @CurrentSession() auth: CurrentAuth,
    @Body() dto: RetirarPlanAnteriorDto,
  ) {
    return this.ofertas.retirarAnterior(auth, dto);
  }
}
