import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';

import { CurrentSession } from '../auth/current-auth.decorator';
import type { CurrentAuth } from '../auth/auth.types';
import { Permiso } from '../auth/permiso.decorator';
import { OcultaMargenes } from '../auth/margenes.decorator';
import { EgresosService } from './egresos.service';
import { RecurrentesService } from './recurrentes.service';
import {
  CrearRecurrenteDto,
  EditarRecurrenteDto,
} from './dto/recurrente.dto';
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
  constructor(
    private readonly egresos: EgresosService,
    private readonly recurrentes: RecurrentesService,
  ) {}

  // ── Gastos recurrentes (F3) ────────────────────────────────────────────

  @Get('recurrentes')
  listarRecurrentes(@CurrentSession() auth: CurrentAuth) {
    return this.recurrentes.listar(auth);
  }

  @Permiso('administracion.gestionar')
  @Post('recurrentes')
  crearRecurrente(
    @CurrentSession() auth: CurrentAuth,
    @Body() body: CrearRecurrenteDto,
  ) {
    return this.recurrentes.crear(auth, body);
  }

  /** Emitir a mano lo pendiente, sin esperar al cron de la madrugada. */
  @Permiso('administracion.gestionar')
  @Post('recurrentes/generar')
  generarRecurrentes(@CurrentSession() auth: CurrentAuth) {
    return this.recurrentes.generarAhora(auth);
  }

  /** Presupuestado vs. real de la estructura (journey E4). */
  @Get('presupuestado')
  presupuestadoVsReal(
    @CurrentSession() auth: CurrentAuth,
    @Query('periodo') periodo?: string,
  ) {
    return this.recurrentes.presupuestadoVsReal(auth, periodo);
  }

  @Permiso('administracion.gestionar')
  @Patch('recurrentes/:id')
  editarRecurrente(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
    @Body() body: EditarRecurrenteDto,
  ) {
    return this.recurrentes.editar(auth, id, body);
  }

  @Permiso('administracion.gestionar')
  @Delete('recurrentes/:id')
  borrarRecurrente(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
  ) {
    return this.recurrentes.borrar(auth, id);
  }

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

  /** Saldo por proveedor con antigüedad: el espejo de la matriz de deudores. */
  @Get('proveedores')
  saldosPorProveedor(@CurrentSession() auth: CurrentAuth) {
    return this.egresos.saldosPorProveedor(auth);
  }

  /** "¿En qué se me va la plata?" — por categoría y naturaleza, por competencia. */
  @Get('reporte')
  reporte(
    @CurrentSession() auth: CurrentAuth,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    return this.egresos.reporte(auth, { desde, hasta });
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

  /**
   * La orden de pago en PDF, para mandarle al proveedor. Se genera al vuelo:
   * no se guarda en el storage porque no se comparte por link, se descarga.
   */
  @Get('pagos/:id/orden-pago.pdf')
  async ordenDePagoPdf(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
    @Res() res: Response,
  ): Promise<void> {
    const pdf = await this.egresos.ordenDePagoPdf(auth, id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="orden-de-pago-${id.slice(0, 8)}.pdf"`,
    );
    res.end(pdf);
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
