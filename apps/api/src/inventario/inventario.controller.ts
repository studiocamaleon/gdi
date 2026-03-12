import { Body, Controller, Get, Param, Patch, Post, Put } from '@nestjs/common';
import type { CurrentAuth } from '../auth/auth.types';
import { CurrentSession } from '../auth/current-auth.decorator';
import { UpsertMateriaPrimaDto } from './dto/upsert-materia-prima.dto';
import { InventarioService } from './inventario.service';

@Controller('inventario/materias-primas')
export class InventarioController {
  constructor(private readonly inventarioService: InventarioService) {}

  @Get()
  findAll(@CurrentSession() auth: CurrentAuth) {
    return this.inventarioService.findAllMateriasPrimas(auth);
  }

  @Get(':id')
  findOne(@CurrentSession() auth: CurrentAuth, @Param('id') id: string) {
    return this.inventarioService.findMateriaPrima(auth, id);
  }

  @Post()
  create(
    @CurrentSession() auth: CurrentAuth,
    @Body() payload: UpsertMateriaPrimaDto,
  ) {
    return this.inventarioService.createMateriaPrima(auth, payload);
  }

  @Put(':id')
  update(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
    @Body() payload: UpsertMateriaPrimaDto,
  ) {
    return this.inventarioService.updateMateriaPrima(auth, id, payload);
  }

  @Patch(':id/toggle')
  toggle(@CurrentSession() auth: CurrentAuth, @Param('id') id: string) {
    return this.inventarioService.toggleMateriaPrima(auth, id);
  }
}
