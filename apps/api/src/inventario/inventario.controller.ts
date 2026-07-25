import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import type { CurrentAuth } from '../auth/auth.types';
import { CurrentSession } from '../auth/current-auth.decorator';
import { BulkUpdateCostosDto } from './dto/bulk-update-costos.dto';
import { ListMateriasPrimasQueryDto } from './dto/list-materias-primas-query.dto';
import { InstallMaterialPresetDto } from './dto/install-material-preset.dto';
import { UpdateVariantePrecioReferenciaDto } from './dto/update-variante-precio-referencia.dto';
import { UpsertMateriaPrimaDto } from './dto/upsert-materia-prima.dto';
import { InventarioBibliotecaService } from './inventario-biblioteca.service';
import { InventarioService } from './inventario.service';
import { Permiso } from '../auth/permiso.decorator';

@Permiso('inventario.ver')
@Controller('inventario/materias-primas')
export class InventarioController {
  constructor(
    private readonly inventarioService: InventarioService,
    private readonly bibliotecaService: InventarioBibliotecaService,
  ) {}

  @Get()
  findAll(
    @CurrentSession() auth: CurrentAuth,
    @Query() query: ListMateriasPrimasQueryDto,
  ) {
    return this.inventarioService.findAllMateriasPrimas(auth, {
      pagination: query,
      search: query.search?.trim() || undefined,
    });
  }

  @Get('biblioteca')
  listarBiblioteca(@CurrentSession() auth: CurrentAuth) {
    return this.bibliotecaService.listar(auth);
  }

  @Get('biblioteca/:key')
  obtenerBiblioteca(
    @CurrentSession() auth: CurrentAuth,
    @Param('key') key: string,
  ) {
    return this.bibliotecaService.obtener(auth, key);
  }

  @Permiso('inventario.gestionar')
  @Post('biblioteca/:key/instalar')
  instalarBiblioteca(
    @CurrentSession() auth: CurrentAuth,
    @Param('key') key: string,
    @Body() payload: InstallMaterialPresetDto,
  ) {
    return this.bibliotecaService.instalar(auth, key, payload);
  }

  // Ruta literal antes de las rutas con :id para evitar ambigüedad de matcheo.
  @Permiso('inventario.gestionar')
  @Patch('costos')
  bulkUpdateCostos(
    @CurrentSession() auth: CurrentAuth,
    @Body() payload: BulkUpdateCostosDto,
  ) {
    return this.inventarioService.bulkUpdateCostos(auth, payload);
  }

  @Get(':id')
  findOne(@CurrentSession() auth: CurrentAuth, @Param('id') id: string) {
    return this.inventarioService.findMateriaPrima(auth, id);
  }

  @Permiso('inventario.gestionar')
  @Post()
  create(
    @CurrentSession() auth: CurrentAuth,
    @Body() payload: UpsertMateriaPrimaDto,
  ) {
    return this.inventarioService.createMateriaPrima(auth, payload);
  }

  @Permiso('inventario.gestionar')
  @Put(':id')
  update(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
    @Body() payload: UpsertMateriaPrimaDto,
  ) {
    return this.inventarioService.updateMateriaPrima(auth, id, payload);
  }

  @Permiso('inventario.gestionar')
  @Patch(':id/toggle')
  toggle(@CurrentSession() auth: CurrentAuth, @Param('id') id: string) {
    return this.inventarioService.toggleMateriaPrima(auth, id);
  }

  @Permiso('inventario.gestionar')
  @Patch('variantes/:varianteId/precio-referencia')
  updateVariantePrecioReferencia(
    @CurrentSession() auth: CurrentAuth,
    @Param('varianteId') varianteId: string,
    @Body() payload: UpdateVariantePrecioReferenciaDto,
  ) {
    return this.inventarioService.updateVariantePrecioReferencia(
      auth,
      varianteId,
      payload,
    );
  }
}
