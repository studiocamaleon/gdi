import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { CurrentSession } from '../auth/current-auth.decorator';
import { UpsertProveedorDto } from './dto/upsert-proveedor.dto';
import { ProveedoresService } from './proveedores.service';
import type { CurrentAuth } from '../auth/auth.types';

@Controller('proveedores')
export class ProveedoresController {
  constructor(private readonly proveedoresService: ProveedoresService) {}

  @Get()
  findAll(@CurrentSession() auth: CurrentAuth) {
    return this.proveedoresService.findAll(auth);
  }

  @Get(':id')
  findOne(@CurrentSession() auth: CurrentAuth, @Param('id') id: string) {
    return this.proveedoresService.findOne(auth, id);
  }

  @Post()
  create(
    @CurrentSession() auth: CurrentAuth,
    @Body() payload: UpsertProveedorDto,
  ) {
    return this.proveedoresService.create(auth, payload);
  }

  @Put(':id')
  update(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
    @Body() payload: UpsertProveedorDto,
  ) {
    return this.proveedoresService.update(auth, id, payload);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentSession() auth: CurrentAuth, @Param('id') id: string) {
    await this.proveedoresService.remove(auth, id);
  }
}
