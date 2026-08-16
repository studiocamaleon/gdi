import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { CurrentSession } from '../auth/current-auth.decorator';
import {
  EstadoProveedorDto,
  ImportarProveedoresDto,
  UpdateProveedorDto,
  UpsertProveedorDto,
} from './dto/upsert-proveedor.dto';
import { ProveedoresQueryDto } from './dto/proveedores-query.dto';
import { ProveedoresService } from './proveedores.service';
import type { CurrentAuth } from '../auth/auth.types';
import { Permiso } from '../auth/permiso.decorator';

@Permiso('registros.ver')
@Controller('proveedores')
export class ProveedoresController {
  constructor(private readonly proveedoresService: ProveedoresService) {}

  @Get()
  findAll(
    @CurrentSession() auth: CurrentAuth,
    @Query() pagination: ProveedoresQueryDto,
  ) {
    return this.proveedoresService.findAll(auth, pagination);
  }

  @Get('opciones')
  opciones(@CurrentSession() auth: CurrentAuth) {
    return this.proveedoresService.opciones(auth);
  }

  @Get(':id')
  findOne(@CurrentSession() auth: CurrentAuth, @Param('id') id: string) {
    return this.proveedoresService.findOne(auth, id);
  }

  @Permiso('registros.gestionar')
  @Post()
  create(
    @CurrentSession() auth: CurrentAuth,
    @Body() payload: UpsertProveedorDto,
  ) {
    return this.proveedoresService.create(auth, payload);
  }

  @Permiso('registros.gestionar')
  @Post('importar')
  importar(
    @CurrentSession() auth: CurrentAuth,
    @Body() payload: ImportarProveedoresDto,
  ) {
    return this.proveedoresService.importar(auth, payload.proveedores);
  }

  @Permiso('registros.gestionar')
  @Put(':id')
  update(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
    @Body() payload: UpdateProveedorDto,
  ) {
    return this.proveedoresService.update(auth, id, payload);
  }

  @Permiso('registros.gestionar')
  @Patch(':id/estado')
  estado(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
    @Body() payload: EstadoProveedorDto,
  ) {
    return this.proveedoresService.fijarActivo(auth, id, payload.activo);
  }

  @Permiso('registros.gestionar')
  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentSession() auth: CurrentAuth, @Param('id') id: string) {
    await this.proveedoresService.remove(auth, id);
  }
}
