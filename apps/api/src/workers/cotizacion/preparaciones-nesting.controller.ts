import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { CurrentSession } from '../../auth/current-auth.decorator';
import type { CurrentAuth } from '../../auth/auth.types';
import { Permiso } from '../../auth/permiso.decorator';
import { PreparacionesNestingService } from './preparaciones-nesting.service';

export class PrepararNestingsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(10000, { each: true })
  cantidades!: number[];

  @IsOptional()
  @IsUUID()
  rutaAlternativaId?: string;
}

@Permiso('costos.ver')
@Controller('productos-servicios/productos/:productoId/nestings')
export class PreparacionesNestingController {
  constructor(private readonly preparaciones: PreparacionesNestingService) {}

  @Get()
  listar(
    @CurrentSession() auth: CurrentAuth,
    @Param('productoId', ParseUUIDPipe) productoId: string,
  ) {
    return this.preparaciones.listar(auth.tenantId, productoId);
  }

  @Post()
  @Permiso('costos.gestionar')
  preparar(
    @CurrentSession() auth: CurrentAuth,
    @Param('productoId', ParseUUIDPipe) productoId: string,
    @Body() dto: PrepararNestingsDto,
  ) {
    return this.preparaciones.preparar(
      auth.tenantId,
      productoId,
      dto.cantidades,
      dto.rutaAlternativaId,
    );
  }
}
