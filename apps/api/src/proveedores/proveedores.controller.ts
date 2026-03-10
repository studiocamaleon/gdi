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
import { UpsertProveedorDto } from './dto/upsert-proveedor.dto';
import { ProveedoresService } from './proveedores.service';

@Controller('proveedores')
export class ProveedoresController {
  constructor(private readonly proveedoresService: ProveedoresService) {}

  @Get()
  findAll() {
    return this.proveedoresService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.proveedoresService.findOne(id);
  }

  @Post()
  create(@Body() payload: UpsertProveedorDto) {
    return this.proveedoresService.create(payload);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() payload: UpsertProveedorDto) {
    return this.proveedoresService.update(id, payload);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    await this.proveedoresService.remove(id);
  }
}
