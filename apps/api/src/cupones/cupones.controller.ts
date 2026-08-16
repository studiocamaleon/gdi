import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { RolSistema } from '@prisma/client';
import { CurrentSession } from '../auth/current-auth.decorator';
import type { CurrentAuth } from '../auth/auth.types';
import { Permiso } from '../auth/permiso.decorator';
import { Roles } from '../auth/roles.decorator';
import { CuponesService } from './cupones.service';
import {
  ActualizarCuponDto,
  CrearCuponDto,
  ListarCuponesDto,
  ValidarCuponDto,
} from './dto/cupones.dto';

@Permiso('comercial.ver')
@Controller('cupones')
export class CuponesController {
  constructor(private readonly service: CuponesService) {}

  @Get()
  listar(
    @CurrentSession() auth: CurrentAuth,
    @Query() filtros: ListarCuponesDto,
  ) {
    return this.service.listar(auth, filtros);
  }

  // Crear/editar cupones ES autorizar descuentos (por eso aplicarlos no
  // gatea): mismo permiso y roles que resolver una aprobación.
  @Permiso('comercial.aprobar_descuento')
  @Roles(RolSistema.ADMINISTRADOR, RolSistema.SUPERVISOR)
  @Post()
  crear(@CurrentSession() auth: CurrentAuth, @Body() dto: CrearCuponDto) {
    return this.service.crear(auth, dto);
  }

  @Permiso('comercial.aprobar_descuento')
  @Roles(RolSistema.ADMINISTRADOR, RolSistema.SUPERVISOR)
  @Patch(':id')
  actualizar(
    @CurrentSession() auth: CurrentAuth,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarCuponDto,
  ) {
    return this.service.actualizar(auth, id, dto);
  }

  @Permiso('comercial.aprobar_descuento')
  @Roles(RolSistema.ADMINISTRADOR, RolSistema.SUPERVISOR)
  @Delete(':id')
  eliminar(
    @CurrentSession() auth: CurrentAuth,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.eliminar(auth, id);
  }

  /** El comercial valida el código (tecleado o escaneado) contra su carrito. */
  @Permiso('comercial.gestionar')
  @Post('validar')
  validar(@CurrentSession() auth: CurrentAuth, @Body() dto: ValidarCuponDto) {
    return this.service.validar(auth, dto);
  }

  @Get(':id/historial')
  historial(
    @CurrentSession() auth: CurrentAuth,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.historial(auth, id);
  }
}
