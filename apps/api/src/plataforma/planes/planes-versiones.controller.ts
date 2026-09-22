import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Throttle } from '@nestjs/throttler';
import { SinTenant } from '../../common/sin-tenant.decorator';
import { CurrentSession } from '../../auth/current-auth.decorator';
import type { CurrentAuth } from '../../auth/auth.types';
import { PlataformaGuard } from '../plataforma.guard';
import { PlataformaAdminGuard } from '../plataforma-admin.guard';
import { PlanesVersionesService } from './planes-versiones.service';

export class PublicarPlanDto {
  @IsInt() @Min(1) revision: number;
  @IsInt() @Min(1) catalogoVersion: number;
  @IsString() @MinLength(5) @MaxLength(500) motivo: string;
}
export class HistorialPlanesDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) antes?: number;
}

@Controller('plataforma/planes-versiones')
@SinTenant()
@UseGuards(PlataformaGuard)
export class PlanesVersionesController {
  constructor(private readonly versiones: PlanesVersionesService) {}
  @Get('borrador/:id')
  @Header('Cache-Control', 'no-store')
  listar(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: HistorialPlanesDto,
  ) {
    return this.versiones.listar(id, query.antes);
  }
  @Get(':id')
  @Header('Cache-Control', 'no-store')
  detalle(@Param('id', ParseUUIDPipe) id: string) {
    return this.versiones.detalle(id);
  }
  @Post('borrador/:id')
  @Header('Cache-Control', 'no-store')
  @UseGuards(PlataformaAdminGuard)
  @Throttle({ default: { ttl: 60000, limit: 20 } })
  publicar(
    @CurrentSession() auth: CurrentAuth,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PublicarPlanDto,
  ) {
    return this.versiones.publicar(auth, id, dto);
  }
}
