import { Body, Controller, Header, Post, UseGuards } from '@nestjs/common';
import {
  ArrayUnique,
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { Throttle } from '@nestjs/throttler';
import { SinTenant } from '../../common/sin-tenant.decorator';
import { CurrentSession } from '../../auth/current-auth.decorator';
import type { CurrentAuth } from '../../auth/auth.types';
import { PlataformaGuard } from '../plataforma.guard';
import { PlataformaAdminGuard } from '../plataforma-admin.guard';
import { PlanesAsignacionService } from './planes-asignacion.service';

export class ConsultarAsignacionDto {
  @IsUUID() tenantId: string;
  @ValidateIf((_o, v) => v !== null) @IsUUID() versionId: string | null;
}
export class AsignarVersionDto extends ConsultarAsignacionDto {
  @IsUUID() operacionId: string;
  @IsInt() @Min(0) revision: number;
  @IsString() @Matches(/^[a-f0-9]{64}$/) huella: string;
  @IsString() @MinLength(5) @MaxLength(500) motivo: string;
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  revisionesAceptadas: string[];
}
@Controller('plataforma/planes-asignacion')
@SinTenant()
@UseGuards(PlataformaGuard)
export class PlanesAsignacionController {
  constructor(private readonly planes: PlanesAsignacionService) {}
  @Post('diagnostico')
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { ttl: 60000, limit: 30 } })
  diagnostico(@Body() dto: ConsultarAsignacionDto) {
    return this.planes.diagnostico(dto);
  }
  @Post()
  @Header('Cache-Control', 'no-store')
  @UseGuards(PlataformaAdminGuard)
  @Throttle({ default: { ttl: 60000, limit: 20 } })
  asignar(@CurrentSession() auth: CurrentAuth, @Body() dto: AsignarVersionDto) {
    return this.planes.asignar(auth, dto);
  }
}
