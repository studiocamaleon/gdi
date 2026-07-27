import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import { CurrentSession } from '../auth/current-auth.decorator';
import type { CurrentAuth } from '../auth/auth.types';
import { Permiso } from '../auth/permiso.decorator';
import { OcultaMargenes } from '../auth/margenes.decorator';
import { EgresosService } from './egresos.service';
import {
  AnularDto,
  CrearCategoriaEgresoDto,
  CrearEgresoDto,
  EditarCategoriaEgresoDto,
  EditarEgresoDto,
  RegistrarPagoDto,
} from './dto/egreso.dto';

/**
 * Egresos y Cuentas por pagar.
 *
 * La base es `administracion.ver` y no un permiso nuevo: esto es el otro lado
 * del mostrador de Cobros. El **Vendedor** queda naturalmente afuera —tiene
 * `administracion.cobrar` pero no `administracion.ver`—, y eso es lo correcto:
 * lo que le pagamos a un proveedor es información de compra.
 *
 * `@OcultaMargenes` porque el payload puede arrastrar costos de proveedor.
 *
 * Ver docs/egresos-y-cuentas-por-pagar-diseno.md
 */
@OcultaMargenes()
@Permiso('administracion.ver')
@Controller('egresos')
export class EgresosController {
  constructor(private readonly egresos: EgresosService) {}

  // ── Categorías ─────────────────────────────────────────────────────────

  @Get('categorias')
  categorias(@CurrentSession() auth: CurrentAuth) {
    return this.egresos.categorias(auth);
  }

  @Permiso('administracion.configurar')
  @Post('categorias')
  crearCategoria(
    @CurrentSession() auth: CurrentAuth,
    @Body() body: CrearCategoriaEgresoDto,
  ) {
    return this.egresos.crearCategoria(auth, body);
  }

  @Permiso('administracion.configurar')
  @Patch('categorias/:id')
  editarCategoria(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
    @Body() body: EditarCategoriaEgresoDto,
  ) {
    return this.egresos.editarCategoria(auth, id, body);
  }

  @Permiso('administracion.configurar')
  @Delete('categorias/:id')
  borrarCategoria(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
  ) {
    return this.egresos.borrarCategoria(auth, id);
  }

  // ── Resumen ────────────────────────────────────────────────────────────

  /** Los números de la cabecera: qué hay que pagar, qué está vencido. */
  @Get('resumen')
  resumen(@CurrentSession() auth: CurrentAuth) {
    return this.egresos.resumen(auth);
  }

  // ── Pagos ──────────────────────────────────────────────────────────────

  @Permiso('administracion.gestionar')
  @Post('pagos')
  registrarPago(
    @CurrentSession() auth: CurrentAuth,
    @Body() body: RegistrarPagoDto,
  ) {
    return this.egresos.registrarPago(auth, body);
  }

  @Permiso('administracion.anular')
  @Patch('pagos/:id/anular')
  anularPago(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
    @Body() body: AnularDto,
  ) {
    return this.egresos.anularPago(auth, id, body);
  }

  // ── Egresos ────────────────────────────────────────────────────────────

  @Get()
  listar(
    @CurrentSession() auth: CurrentAuth,
    @Query('estado') estado?: string,
    @Query('categoriaId') categoriaId?: string,
    @Query('proveedorId') proveedorId?: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('eje') eje?: string,
    @Query('soloPendientes') soloPendientes?: string,
    @Query('texto') texto?: string,
  ) {
    return this.egresos.listar(auth, {
      estado,
      categoriaId,
      proveedorId,
      desde,
      hasta,
      eje,
      soloPendientes,
      texto,
    });
  }

  @Permiso('administracion.gestionar')
  @Post()
  crear(@CurrentSession() auth: CurrentAuth, @Body() body: CrearEgresoDto) {
    return this.egresos.crear(auth, body);
  }

  @Get(':id/pagos')
  pagosDeEgreso(@CurrentSession() auth: CurrentAuth, @Param('id') id: string) {
    return this.egresos.pagosDeEgreso(auth, id);
  }

  @Permiso('administracion.gestionar')
  @Patch(':id')
  editar(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
    @Body() body: EditarEgresoDto,
  ) {
    return this.egresos.editar(auth, id, body);
  }

  @Permiso('administracion.anular')
  @Patch(':id/anular')
  anular(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
    @Body() body: AnularDto,
  ) {
    return this.egresos.anular(auth, id, body);
  }
}
