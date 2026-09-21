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
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Throttle } from '@nestjs/throttler';
import type { RolPlataforma } from '@prisma/client';
import { CurrentSession } from '../auth/current-auth.decorator';
import type { CurrentAuth } from '../auth/auth.types';
import { SinTenant } from '../common/sin-tenant.decorator';
import { PlataformaGuard } from './plataforma.guard';
import { PlataformaAdminGuard } from './plataforma-admin.guard';
import { PaginaPlataformaDto } from './plataforma.controller';
import { EquipoPlataformaService } from './equipo.service';

export class ConsultaEquipoDto extends PaginaPlataformaDto {
  @IsOptional() @IsString() @MaxLength(100) q?: string;
}
class MotivoEquipoDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(5)
  @MaxLength(300)
  motivo: string;
}
export class AgregarEquipoDto extends MotivoEquipoDto {
  @IsEmail() @MaxLength(254) email: string;
  @IsIn(['ADMIN', 'SOPORTE']) rol: RolPlataforma;
}
export class ActualizarEquipoDto extends MotivoEquipoDto {
  @IsIn(['rol', 'revocar', 'sesiones']) accion: 'rol' | 'revocar' | 'sesiones';
  @IsIn(['ADMIN', 'SOPORTE']) rolActual: RolPlataforma;
  @IsOptional() @IsIn(['ADMIN', 'SOPORTE']) rol?: RolPlataforma;
}
export class GestionInvitacionEquipoDto extends MotivoEquipoDto {
  @IsIn(['cancelar', 'renovar']) accion: 'cancelar' | 'renovar';
}

@Controller('plataforma/equipo')
@SinTenant()
@UseGuards(PlataformaGuard)
export class EquipoPlataformaController {
  constructor(private readonly equipo: EquipoPlataformaService) {}
  @Get('invitaciones')
  @Header('Cache-Control', 'no-store')
  invitaciones(@Query() dto: ConsultaEquipoDto) {
    return this.equipo.invitaciones(dto.pagina, dto.limite);
  }
  @Post('invitaciones')
  @UseGuards(PlataformaAdminGuard)
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  invitar(@CurrentSession() auth: CurrentAuth, @Body() dto: AgregarEquipoDto) {
    return this.equipo.invitar(auth, dto.email, dto.rol, dto.motivo);
  }
  @Post('invitaciones/:id')
  @UseGuards(PlataformaAdminGuard)
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  gestionarInvitacion(
    @CurrentSession() auth: CurrentAuth,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: GestionInvitacionEquipoDto,
  ) {
    return this.equipo.gestionarInvitacion(auth, id, dto.accion, dto.motivo);
  }
  @Get()
  @Header('Cache-Control', 'no-store')
  listar(@CurrentSession() auth: CurrentAuth, @Query() dto: ConsultaEquipoDto) {
    return this.equipo.listar(auth, dto.pagina, dto.limite, dto.q);
  }
  @Get('historial')
  @Header('Cache-Control', 'no-store')
  historial(@Query() dto: PaginaPlataformaDto) {
    return this.equipo.historial(dto.pagina, dto.limite);
  }
  @Post()
  @UseGuards(PlataformaAdminGuard)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  agregar(@CurrentSession() auth: CurrentAuth, @Body() dto: AgregarEquipoDto) {
    return this.equipo.agregar(auth, dto.email, dto.rol, dto.motivo);
  }
  @Put(':id')
  @UseGuards(PlataformaAdminGuard)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  actualizar(
    @CurrentSession() auth: CurrentAuth,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarEquipoDto,
  ) {
    return this.equipo.actualizar(
      auth,
      id,
      dto.accion,
      dto.rolActual,
      dto.rol,
      dto.motivo,
    );
  }
}
