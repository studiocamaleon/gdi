import {
  Body,
  Controller,
  Get,
  Header,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Throttle } from '@nestjs/throttler';
import { SinTenant } from '../../common/sin-tenant.decorator';
import { CurrentSession } from '../../auth/current-auth.decorator';
import type { CurrentAuth } from '../../auth/auth.types';
import { PlataformaGuard } from '../plataforma.guard';
import { PlataformaAdminGuard } from '../plataforma-admin.guard';
import { PlanesBorradoresService } from './planes-borradores.service';
import type { ContenidoPlan } from './catalogo-planes';
import { PlanesComparacionService } from './planes-comparacion.service';

export class ContenidoPlanDto implements ContenidoPlan {
  @IsString() @MaxLength(60) nombre: string;
  @IsString() @MaxLength(200) descripcion: string;
  @IsInt() @Min(1) @Max(10000) usuariosIncluidos: number;
  @IsBoolean() adicionalesPermitidos: boolean;
  @IsIn(['pendiente', 'limitado', 'ilimitado'])
  almacenamientoModo: ContenidoPlan['almacenamientoModo'];
  @IsOptional() @IsInt() @Min(1) @Max(100000) almacenamientoGb: number | null;
  @IsObject() funciones: Record<string, boolean>;
}
export class CambioBorradorDto {
  @IsUUID() id: string;
  @IsInt() @Min(1) revision: number;
  @IsObject()
  @ValidateNested()
  @Type(() => ContenidoPlanDto)
  contenido: ContenidoPlanDto;
}
export class GuardarPlanesDto {
  @IsInt() @Min(1) catalogoVersion: number;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => CambioBorradorDto)
  cambios: CambioBorradorDto[];
}

export class CompararPlanesDto {
  @IsUUID() tenantId: string;
  @IsInt() @Min(1) catalogoVersion: number;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ContenidoPlanDto)
  planes: ContenidoPlanDto[];
}

@Controller('plataforma/planes-borradores')
@SinTenant()
@UseGuards(PlataformaGuard)
export class PlanesBorradoresController {
  constructor(
    private readonly planes: PlanesBorradoresService,
    private readonly comparacion: PlanesComparacionService,
  ) {}
  @Post('comparar')
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { ttl: 60000, limit: 30 } })
  comparar(@Body() dto: CompararPlanesDto) {
    return this.comparacion.comparar(
      dto.tenantId,
      dto.catalogoVersion,
      dto.planes,
    );
  }
  @Get()
  @Header('Cache-Control', 'no-store')
  listar() {
    return this.planes.listar();
  }
  @Put()
  @Header('Cache-Control', 'no-store')
  @UseGuards(PlataformaAdminGuard)
  @Throttle({ default: { ttl: 60000, limit: 30 } })
  guardar(@CurrentSession() auth: CurrentAuth, @Body() dto: GuardarPlanesDto) {
    return this.planes.guardar(auth, dto);
  }
}
