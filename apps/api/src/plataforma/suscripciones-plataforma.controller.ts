import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  Min,
  Max,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Throttle } from '@nestjs/throttler';
import { CurrentSession } from '../auth/current-auth.decorator';
import type { CurrentAuth } from '../auth/auth.types';
import { SinTenant } from '../common/sin-tenant.decorator';
import { PlataformaGuard } from './plataforma.guard';
import { PlataformaAdminGuard } from './plataforma-admin.guard';
import { PaginaPlataformaDto } from './plataforma.controller';
import {
  SuscripcionesPlataformaService,
  type ConsultaSuscripciones,
} from './suscripciones-plataforma.service';

export class ConsultaSuscripcionesDto
  extends PaginaPlataformaDto
  implements ConsultaSuscripciones
{
  @IsOptional() @IsString() @MaxLength(100) q?: string;
  @IsOptional() @IsIn(['manual', 'paddle']) proveedor?: 'manual' | 'paddle';
  @IsOptional()
  @IsIn(['atencion', 'mora', 'prueba', 'desactualizada', 'bloqueada'])
  caso?: ConsultaSuscripciones['caso'];
}
export class ConsultarPaddleDto {
  @IsUUID() solicitudId: string;
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(5)
  @MaxLength(300)
  motivo: string;
}
export class AjustarCupoUsuariosDto {
  @IsInt() @Min(0) @Max(10000) adicionales: number;
  @IsInt() @Min(0) @Max(10000) anteriores: number;
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @MinLength(5) @MaxLength(300) motivo: string;
}
@Controller('plataforma/suscripciones')
@SinTenant()
@UseGuards(PlataformaGuard)
export class SuscripcionesPlataformaController {
  constructor(private readonly service: SuscripcionesPlataformaService) {}
  @Get() @Header('Cache-Control', 'no-store') listar(
    @Query() dto: ConsultaSuscripcionesDto,
  ) {
    return this.service.listar(dto);
  }
  @Get(':id') @Header('Cache-Control', 'no-store') detalle(
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.detalle(id);
  }
  @Get(':id/cupo-usuarios') @Header('Cache-Control', 'no-store') cupoUsuarios(
    @Param('id', ParseUUIDPipe) id: string,
  ) { return this.service.cupoUsuarios(id); }

  @Put(':id/cupo-usuarios')
  @UseGuards(PlataformaAdminGuard)
  @Header('Cache-Control', 'no-store')
  ajustarCupoUsuarios(@CurrentSession() auth: CurrentAuth, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AjustarCupoUsuariosDto) {
    return this.service.ajustarCupoUsuarios(auth, id, dto);
  }

  @Get(':id/eventos') @Header('Cache-Control', 'no-store') eventos(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() dto: PaginaPlataformaDto,
  ) {
    return this.service.eventos(id, dto.pagina, dto.limite);
  }
  @Get(':id/historial') @Header('Cache-Control', 'no-store') historial(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() dto: PaginaPlataformaDto,
  ) {
    return this.service.historial(id, dto.pagina, dto.limite);
  }
  @Post(':id/sincronizar')
  @UseGuards(PlataformaAdminGuard)
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  sincronizar(
    @CurrentSession() auth: CurrentAuth,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConsultarPaddleDto,
  ) {
    return this.service.sincronizar(auth, id, dto.solicitudId, dto.motivo);
  }
}
