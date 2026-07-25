import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { CurrentSession } from '../auth/current-auth.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';
import { UpsertProveedorDto } from './dto/upsert-proveedor.dto';
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
    @Query() pagination: PaginationDto,
  ) {
    return this.proveedoresService.findAll(auth, pagination);
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
  @Put(':id')
  update(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
    @Body() payload: UpsertProveedorDto,
  ) {
    return this.proveedoresService.update(auth, id, payload);
  }

  @Permiso('registros.gestionar')
  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentSession() auth: CurrentAuth, @Param('id') id: string) {
    await this.proveedoresService.remove(auth, id);
  }
}
