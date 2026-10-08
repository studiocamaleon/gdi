import { FacturacionPaginaDto, ComprobantesPaginaDto } from './dto/listado-fiscal.dto';
import { RequiereCapacidad } from '../suscripciones/capacidad.guard';
import {
  Body,
  Controller,
  Delete,
  Get,
  ForbiddenException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { ProhibidoImpersonando } from '../auth/prohibido-impersonando.decorator';
import type { Response } from 'express';
import { CurrentSession } from '../auth/current-auth.decorator';
import type { CurrentAuth } from '../auth/auth.types';
import { MetodosPagoService } from './metodos-pago.service';
import { CobrosService } from './cobros.service';
import { TesoreriaService } from './tesoreria.service';
import { ConfiguracionFiscalService } from './configuracion-fiscal.service';
import { AfipIntegracionService } from './afip-integracion.service';
import { ComprobantesService } from './comprobantes.service';
import { ImputacionesService } from './imputaciones.service';
import { CuentaCorrienteService } from './cuenta-corriente.service';
import { FacturaService } from './factura.service';
import { EstadoCuentaPdfService } from './estado-cuenta-pdf.service';
import { RecibosService } from './recibos.service';
import { ArchivosService } from '../archivos/archivos.service';
import { DatosEmpresaService } from '../tenants/datos-empresa.service';
import { UpsertMetodoPagoDto } from './dto/metodo-pago.dto';
import {
  AcreditarCobroDto,
  AnularCobroDto,
  CrearCobroDto,
} from './dto/cobro.dto';
import {
  CargarCaeDto,
  CrearComprobanteDto,
  FacturarOrdenDto,
  NotaCreditoOrdenDto,
  ImputarCobroDto,
} from './dto/comprobante.dto';
import { FacturacionOrdenesService } from './facturacion-ordenes.service';
import { FacturacionPendientesQueryDto } from './dto/facturacion-pendientes.dto';
import {
  UpsertConfiguracionFiscalDto,
  UpsertPuntoVentaDto,
} from './dto/configuracion-fiscal.dto';
import type { CondicionFiscalReceptor } from './letra-comprobante';
import {
  AcreditarValorDto,
  AjusteFondosDto,
  ArqueoDto,
  ConciliarMovimientoDto,
  DepositarValorDto,
  EditarCuentaFondosDto,
  MovimientosFondosQueryDto,
  RechazarValorDto,
  RevertirOperacionValorDto,
  TransferenciaDto,
  UpsertCuentaFondosDto,
} from './dto/tesoreria.dto';
import { Permiso, RequiereVista } from '../auth/permiso.decorator';

@Permiso("administracion.comprobantes.ver")
@Controller('administracion')
export class AdministracionController {
  constructor(
    private readonly metodosPagoService: MetodosPagoService,
    private readonly cobrosService: CobrosService,
    private readonly recibosService: RecibosService,
    private readonly afipIntegracion: AfipIntegracionService,
    private readonly tesoreriaService: TesoreriaService,
    private readonly configuracionFiscalService: ConfiguracionFiscalService,
    private readonly comprobantesService: ComprobantesService,
    private readonly imputacionesService: ImputacionesService,
    private readonly cuentaCorrienteService: CuentaCorrienteService,
    private readonly facturaService: FacturaService,
    // El PDF del comprobante ya no se arma acá: lo materializa y lo guarda
    // ComprobantesService (el controller sólo redirige al storage).
    private readonly estadoCuentaPdfService: EstadoCuentaPdfService,
    private readonly facturacionOrdenesService: FacturacionOrdenesService,
    private readonly archivos: ArchivosService,
    private readonly datosEmpresa: DatosEmpresaService,
  ) {}

  /**
   * El PDF del comprobante. Sale del storage: se congela al emitir (y se
   * rehace al cargar el CAE a mano), así que es el MISMO archivo cada vez —
   * el que se descarga y el que se le manda al cliente. Antes se
   * re-renderizaba en cada request contra la configuración fiscal viva.
   */
  @Get('comprobantes/:id/pdf')
  async facturaPdf(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
    @Res() res: Response,
  ): Promise<void> {
    const archivo = await this.comprobantesService.pdfDe(auth.tenantId, id);
    res.redirect(302, await this.archivos.urlDeDescarga(archivo.id));
  }

  /** El comprobante impreso: todo lo que la ley exige que figure. */
  @Get('comprobantes/:id/factura')
  async factura(@CurrentSession() auth: CurrentAuth, @Param('id') id: string) {
    const [doc, pdfDisponible] = await Promise.all([
      this.facturaService.documento(auth.tenantId, id),
      this.comprobantesService.pdfDisponible(auth.tenantId, id),
    ]);
    return { ...doc, pdfDisponible };
  }

  // ── Cuenta corriente ─────────────────────────────────────────────────

  @Permiso("administracion.cobrar.ver")
  @Get('deudores')
  deudores(@CurrentSession() auth: CurrentAuth) {
    return this.cuentaCorrienteService.deudores(auth);
  }

  @Permiso("administracion.cobrar.ver")
  @Get('clientes/:clienteId/cuenta-corriente')
  cuentaCorriente(
    @CurrentSession() auth: CurrentAuth,
    @Param('clienteId') clienteId: string,
  ) {
    return this.cuentaCorrienteService.obtener(auth, clienteId);
  }

  /**
   * Estado de cuenta en PDF: mismos datos que la vista, generado en el
   * server (mismo patrón que el PDF del comprobante).
   */
  @Permiso("administracion.cobrar.ver")
  @Get('clientes/:clienteId/cuenta-corriente/pdf')
  @RequiereCapacidad('documentos_pdf')
  async cuentaCorrientePdf(
    @CurrentSession() auth: CurrentAuth,
    @Param('clienteId') clienteId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const [cc, config, logo, regional] = await Promise.all([
      this.cuentaCorrienteService.obtener(auth, clienteId),
      this.configuracionFiscalService.obtener(auth),
      this.archivos.logoDataUri(auth.tenantId),
      this.datosEmpresa.regional(auth.tenantId),
    ]);
    const emisor = config
      ? {
          razonSocial: config.razonSocial,
          cuit: config.cuit,
          condicionFiscal: config.condicionFiscal,
          domicilioFiscal: config.domicilioFiscal,
          ingresosBrutos: config.ingresosBrutos,
        }
      : null;
    const pdf = this.estadoCuentaPdfService.generar(
      cc,
      emisor,
      new Date(),
      logo,
      regional.moneda,
    );
    const slug =
      (cc.cliente.nombre || 'cliente')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .toLowerCase() || 'cliente';
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="estado-cuenta-${slug}.pdf"`,
    });
    return new StreamableFile(pdf);
  }

  // ── Comprobantes ─────────────────────────────────────────────────────

  @Permiso("administracion.comprobantes.ver", "administracion.facturacion.gestionar")
  @Get('comprobantes')
  listarComprobantes(
    @CurrentSession() auth: CurrentAuth,
    @Query('estado') estado?: string,
    @Query('tipo') tipo?: string,
    @Query('clienteId') clienteId?: string,
    @Query('ordenId') ordenId?: string,
    @Query('q') q?: string,
  ) {
    // Emitir desde una OT necesita su saldo fiscal; no habilita el listado general.
    if (!auth.permisos?.has("administracion.comprobantes.ver") && !ordenId) {
      throw new ForbiddenException("Necesitás permiso de comprobantes para consultar el listado general.");
    }
    return this.comprobantesService.listar(auth, {
      estado,
      tipo,
      clienteId,
      ordenId,
      q,
    });
  }

  @Permiso("administracion.comprobantes.ver")
  @Get('comprobantes/pagina')
  comprobantesPagina(@CurrentSession() auth: CurrentAuth, @Query() query: ComprobantesPaginaDto) {
    return this.comprobantesService.listarPagina(auth, query);
  }

  @Permiso("administracion.facturacion.ver")
  @Get('facturacion/pendientes/pagina')
  facturacionPagina(@CurrentSession() auth: CurrentAuth, @Query() query: FacturacionPaginaDto) {
    return this.facturacionOrdenesService.pendientesFacturacionPagina(auth.tenantId, query);
  }

  // ── Facturación sobre órdenes ────────────────────────────────────────

  // ── Integración AFIP (facturación electrónica por delegación) ────────
  // Ver docs/integracion-afip-delegacion-diseno.md

  @Permiso("configuracion.fiscal.ver")
  @Get('afip')
  afip(@CurrentSession() auth: CurrentAuth) {
    return this.afipIntegracion.obtener(auth);
  }

  /** Verifica la delegación sin encender nada (chequeo en seco). */
  @ProhibidoImpersonando()
  @Permiso("configuracion.fiscal.gestionar")
  @Post('afip/verificar')
  verificarAfip(@CurrentSession() auth: CurrentAuth) {
    return this.afipIntegracion.verificar(auth);
  }

  /** Enciende la facturación: verifica y, si pasa, activa. */
  @ProhibidoImpersonando()
  @Permiso("configuracion.fiscal.gestionar")
  @Post('afip/activar')
  activarAfip(@CurrentSession() auth: CurrentAuth) {
    return this.afipIntegracion.activar(auth);
  }

  @ProhibidoImpersonando()
  @Permiso("configuracion.fiscal.gestionar")
  @Post('afip/desactivar')
  desactivarAfip(@CurrentSession() auth: CurrentAuth) {
    return this.afipIntegracion.desactivar(auth);
  }

  /** El gate del botón Facturar. Liviano: sólo el booleano. */
  @Permiso("administracion.facturacion.ver")
  @Get('facturacion/estado')
  async estadoFacturacion(@CurrentSession() auth: CurrentAuth) {
    return {
      habilitada: await this.afipIntegracion.facturacionHabilitada(
        auth.tenantId,
      ),
    };
  }

  /** Órdenes finalizadas con saldo sin facturar (vista Facturación). */
  @Permiso("administracion.facturacion.ver")
  @Get('facturacion/pendientes')
  pendientesFacturacion(
    @CurrentSession() auth: CurrentAuth,
    @Query() query: FacturacionPendientesQueryDto,
  ) {
    return this.facturacionOrdenesService.pendientesFacturacion(
      auth.tenantId,
      query,
    );
  }

  /**
   * Nota de crédito contra una factura de la orden. Pide `administracion.anular`
   * —no `gestionar`— porque es la operación que DESHACE: emitir factura y
   * anularla son dos permisos distintos, igual que descartar un comprobante.
   */
  @Permiso("administracion.anular")
  @RequiereVista("administracion.facturacion.ver")
  @Post('ordenes/:ordenId/nota-credito')
  notaCreditoOrden(
    @CurrentSession() auth: CurrentAuth,
    @Param('ordenId') ordenId: string,
    @Body() body: NotaCreditoOrdenDto,
  ) {
    return this.comprobantesService.notaCreditoDeOrden(auth, ordenId, body);
  }

  /** Facturar (parcial o total) una orden desde su ficha. */
  @Permiso("administracion.facturacion.gestionar")
  @Post('ordenes/:ordenId/facturar')
  facturarOrden(
    @CurrentSession() auth: CurrentAuth,
    @Param('ordenId') ordenId: string,
    @Body() body: FacturarOrdenDto,
  ) {
    return this.comprobantesService.facturarOrden(auth, ordenId, body);
  }

  @Get('comprobantes/:id')
  obtenerComprobante(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
  ) {
    return this.comprobantesService.obtener(auth, id);
  }

  @Permiso("administracion.comprobantes.gestionar", "administracion.anular")
  @Post('comprobantes')
  crearComprobante(
    @CurrentSession() auth: CurrentAuth,
    @Body() body: CrearComprobanteDto,
  ) {
    return this.comprobantesService.crear(auth, body);
  }

  @Permiso("administracion.comprobantes.gestionar", "administracion.anular")
  @Post('comprobantes/:id/emitir')
  emitirComprobante(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
  ) {
    return this.comprobantesService.emitir(auth, id);
  }

  @Permiso("administracion.comprobantes.gestionar", "administracion.anular")
  @Post('comprobantes/:id/consultar-emision')
  consultarEmision(
    @CurrentSession() auth: CurrentAuth,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.comprobantesService.consultarEmision(auth, id);
  }

  @Permiso("administracion.comprobantes.gestionar")
  @Post('comprobantes/:id/cae')
  cargarCae(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
    @Body() body: CargarCaeDto,
  ) {
    return this.comprobantesService.cargarCae(auth, id, body);
  }

  // Deshacer un movimiento de plata pide su propio permiso: manejar
  // administración no es lo mismo que poder anular lo ya registrado.
  @Permiso("administracion.anular")
  @RequiereVista("administracion.comprobantes.ver")
  @Delete('comprobantes/:id')
  descartarComprobante(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
  ) {
    return this.comprobantesService.descartar(auth, id);
  }

  // ── Imputaciones ─────────────────────────────────────────────────────

  @Permiso("administracion.cobrar.ver")
  @Get('clientes/:clienteId/comprobantes-pendientes')
  comprobantesPendientes(
    @CurrentSession() auth: CurrentAuth,
    @Param('clienteId') clienteId: string,
  ) {
    return this.imputacionesService.pendientesDeCliente(auth, clienteId);
  }

  @Permiso("administracion.cobrar.gestionar")
  @Post('cobros/:id/imputaciones')
  imputarCobro(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
    @Body() body: ImputarCobroDto,
  ) {
    return this.imputacionesService.imputar(auth, id, body);
  }

  @Permiso("administracion.cobrar.gestionar")
  @Delete('imputaciones/:id')
  quitarImputacion(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
  ) {
    return this.imputacionesService.quitar(auth, id);
  }

  // ── Configuración fiscal del emisor ──────────────────────────────────

  @Permiso("configuracion.fiscal.ver", "administracion.comprobantes.ver", "administracion.facturacion.ver")
  @Get('configuracion-fiscal')
  obtenerConfiguracionFiscal(@CurrentSession() auth: CurrentAuth) {
    return this.configuracionFiscalService.obtener(auth);
  }

  @Permiso("configuracion.fiscal.gestionar")
  @Put('configuracion-fiscal')
  guardarConfiguracionFiscal(
    @CurrentSession() auth: CurrentAuth,
    @Body() body: UpsertConfiguracionFiscalDto,
  ) {
    return this.configuracionFiscalService.guardar(auth, body);
  }

  @Permiso("configuracion.fiscal.ver", "administracion.comprobantes.ver", "administracion.facturacion.ver")
  @Get('configuracion-fiscal/letra')
  letraSugerida(
    @CurrentSession() auth: CurrentAuth,
    @Query('receptor') receptor: CondicionFiscalReceptor,
  ) {
    return this.configuracionFiscalService.letraPara(auth, receptor);
  }

  @Permiso("configuracion.fiscal.gestionar")
  @Post('puntos-venta')
  crearPuntoVenta(
    @CurrentSession() auth: CurrentAuth,
    @Body() body: UpsertPuntoVentaDto,
  ) {
    return this.configuracionFiscalService.crearPuntoVenta(auth, body);
  }

  @Permiso("configuracion.fiscal.gestionar")
  @Patch('puntos-venta/:id')
  actualizarPuntoVenta(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
    @Body() body: UpsertPuntoVentaDto,
  ) {
    return this.configuracionFiscalService.actualizarPuntoVenta(auth, id, body);
  }

  @Permiso("configuracion.fiscal.gestionar")
  @Delete('puntos-venta/:id')
  eliminarPuntoVenta(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
  ) {
    return this.configuracionFiscalService.eliminarPuntoVenta(auth, id);
  }

  // ── Tesorería ────────────────────────────────────────────────────────

  @Permiso("administracion.tesoreria.ver")
  @Get('tesoreria')
  resumenTesoreria(@CurrentSession() auth: CurrentAuth) {
    return this.tesoreriaService.resumen(auth);
  }

  @Permiso('administracion.tesoreria.ver')
  @Get('cuentas/destinos-transferencia')
  destinosTransferencia(@CurrentSession() auth: CurrentAuth) { return this.tesoreriaService.destinos(auth); }

  @Permiso('administracion.tesoreria.ver')
  @Get('cuentas/:id/arqueos')
  arqueos(@CurrentSession() auth: CurrentAuth, @Param('id', ParseUUIDPipe) id: string) { return this.tesoreriaService.arqueos(auth, id); }

  @Permiso("administracion.tesoreria.gestionar")
  @Post('cuentas')
  crearCuenta(
    @CurrentSession() auth: CurrentAuth,
    @Body() payload: UpsertCuentaFondosDto,
  ) {
    return this.tesoreriaService.crearCuenta(auth, payload);
  }

  @Permiso("administracion.tesoreria.ver")
  @Get('cuentas/:id/movimientos')
  movimientosCuenta(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
    @Query() filtros: MovimientosFondosQueryDto,
  ) {
    return this.tesoreriaService.movimientos(auth, id, filtros);
  }

  @Permiso("administracion.tesoreria.gestionar")
  @Patch('cuentas/:id')
  editarCuenta(
    @CurrentSession() auth: CurrentAuth,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() payload: EditarCuentaFondosDto,
  ) {
    return this.tesoreriaService.editarCuenta(auth, id, payload);
  }

  @Permiso("tesoreria.transferir")
  @RequiereVista("administracion.tesoreria.ver")
  @RequiereCapacidad('tesoreria')
  @Post('cuentas/transferencias')
  transferir(
    @CurrentSession() auth: CurrentAuth,
    @Body() payload: TransferenciaDto,
  ) {
    return this.tesoreriaService.transferir(auth, payload);
  }

  @Permiso("tesoreria.arquear")
  @RequiereVista("administracion.tesoreria.ver")
  @RequiereCapacidad('tesoreria')
  @Post('cuentas/:id/arqueo')
  arqueo(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
    @Body() payload: ArqueoDto,
  ) {
    return this.tesoreriaService.arqueo(auth, id, payload);
  }

  @Permiso("administracion.tesoreria.gestionar")
  @RequiereCapacidad('tesoreria')
  @Post('cuentas/:id/ajustes')
  ajustarFondos(
    @CurrentSession() auth: CurrentAuth,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() payload: AjusteFondosDto,
  ) {
    return this.tesoreriaService.ajustar(auth, id, payload);
  }

  @Permiso("administracion.tesoreria.gestionar")
  @RequiereCapacidad('tesoreria')
  @Patch('cuentas/:cuentaId/movimientos/:movimientoId/conciliacion')
  conciliarMovimiento(
    @CurrentSession() auth: CurrentAuth,
    @Param('cuentaId', ParseUUIDPipe) cuentaId: string,
    @Param('movimientoId', ParseUUIDPipe) movimientoId: string,
    @Body() payload: ConciliarMovimientoDto,
  ) {
    return this.tesoreriaService.conciliar(
      auth,
      cuentaId,
      movimientoId,
      payload,
    );
  }

  @Permiso("administracion.tesoreria.ver")
  @Get('valores')
  valores(@CurrentSession() auth: CurrentAuth) {
    return this.tesoreriaService.valores(auth);
  }

  @Permiso("administracion.tesoreria.gestionar")
  @RequiereCapacidad('valores')
  @Post('valores/:id/depositar')
  depositarValor(
    @CurrentSession() auth: CurrentAuth,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() payload: DepositarValorDto,
  ) {
    return this.tesoreriaService.depositarValor(auth, id, payload);
  }

  @Permiso("administracion.tesoreria.gestionar")
  @RequiereCapacidad('valores')
  @Post('valores/:id/acreditar')
  acreditarValor(
    @CurrentSession() auth: CurrentAuth,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() payload: AcreditarValorDto,
  ) {
    return this.tesoreriaService.acreditarValor(auth, id, payload);
  }

  @Permiso("administracion.anular")
  @RequiereVista("administracion.tesoreria.ver")
  @RequiereCapacidad('valores')
  @Post('valores/:id/revertir-deposito')
  revertirDepositoValor(
    @CurrentSession() auth: CurrentAuth,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() payload: RevertirOperacionValorDto,
  ) {
    return this.tesoreriaService.revertirDepositoValor(auth, id, payload);
  }

  @Permiso("administracion.anular")
  @RequiereVista("administracion.tesoreria.ver")
  @RequiereCapacidad('valores')
  @Post('valores/:id/revertir-acreditacion')
  revertirAcreditacionValor(
    @CurrentSession() auth: CurrentAuth,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() payload: RevertirOperacionValorDto,
  ) {
    return this.tesoreriaService.revertirAcreditacionValor(auth, id, payload);
  }

  @Permiso("administracion.anular")
  @RequiereVista("administracion.tesoreria.ver")
  @RequiereCapacidad('valores')
  @Post('valores/:id/rechazar')
  rechazarValor(
    @CurrentSession() auth: CurrentAuth,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() payload: RechazarValorDto,
  ) {
    return this.tesoreriaService.rechazarValor(auth, id, payload);
  }

  // ── Cobros ───────────────────────────────────────────────────────────

  @Permiso("administracion.cobrar.ver", "comercial.ordenes.ver")
  @Get('cobros')
  cobros(
    @CurrentSession() auth: CurrentAuth,
    @Query('ordenId') ordenId?: string,
  ) {
    // El resumen de pagos de una OT pertenece a su vista comercial. No concede
    // el listado global de Cobrar ni evita las restricciones de cajas del servicio.
    if (
      !auth.permisos?.has('administracion.cobrar.ver') &&
      (!ordenId || !auth.permisos?.has('comercial.ordenes.ver'))
    ) {
      throw new ForbiddenException('Seleccioná una orden para consultar sus cobros.');
    }
    return this.cobrosService.findAll(auth, { ordenId });
  }

  @Permiso("administracion.cobrar.ver")
  @Get('cobros/pendientes-acreditacion')
  cobrosPendientesAcreditacion(@CurrentSession() auth: CurrentAuth) {
    return this.cobrosService.pendientesAcreditacion(auth);
  }

  // También el Vendedor: la seña se toma al cerrar la venta, no en la caja.
  @Permiso("administracion.cobrar.gestionar", "administracion.cobrar")
  @Post('cobros')
  crearCobro(
    @CurrentSession() auth: CurrentAuth,
    @Body() payload: CrearCobroDto,
  ) {
    return this.cobrosService.create(auth, payload);
  }

  /**
   * El PDF del recibo. Sale del storage: se genera al registrar el cobro y
   * después es un 302 a una URL firmada. Si el render de fondo falló, este
   * pedido lo rehace.
   */
  @Permiso("administracion.cobrar.ver", "administracion.cobrar")
  @Get('cobros/:id/recibo/pdf')
  async pdfRecibo(
    @CurrentSession() auth: CurrentAuth,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ): Promise<void> {
    await this.exigirLecturaRecibo(auth, id);
    const archivo = await this.recibosService.pdfDe(id, auth.tenantId);
    res.redirect(302, await this.archivos.urlDeDescarga(archivo.id));
  }

  /** El link que se comparte con el cliente (`/c/<token>`), si ya se emitió. */
  @Permiso("administracion.cobrar.ver", "administracion.cobrar")
  @Get('cobros/:id/recibo/enlace')
  async enlaceRecibo(
    @CurrentSession() auth: CurrentAuth,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.exigirLecturaRecibo(auth, id);
    return { url: await this.recibosService.urlPublica(id) };
  }

  private async exigirLecturaRecibo(auth: CurrentAuth, id: string) {
    // findOne comprueba tenant y cuenta operable antes de acceder al archivo.
    const cobro = await this.cobrosService.findOne(auth, id);
    if (
      !auth.permisos?.has('administracion.cobrar.ver') &&
      (!auth.permisos?.has('administracion.cobrar') ||
        !auth.permisos?.has('comercial.ordenes.ver') || !cobro.ordenId)
    ) {
      throw new ForbiddenException('No tenés acceso a este recibo.');
    }
  }

  @Permiso("administracion.cobrar.gestionar")
  @Post('cobros/:id/acreditar')
  acreditarCobro(
    @CurrentSession() auth: CurrentAuth,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() payload: AcreditarCobroDto,
  ) {
    return this.cobrosService.acreditar(auth, id, payload);
  }

  @Permiso("administracion.anular")
  @RequiereVista("administracion.cobrar.ver")
  @Delete('cobros/:id')
  anularCobro(
    @CurrentSession() auth: CurrentAuth,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() payload: AnularCobroDto,
  ) {
    return this.cobrosService.anular(auth, id, payload);
  }

  // El formulario de cobro los necesita para pintarse, así que quien puede
  // cobrar tiene que poder leerlos aunque no vea el resto de administración.
  @Permiso("configuracion.metodos.ver", "administracion.cobrar.ver", "administracion.cobrar", "administracion.egresos.ver", "administracion.pagar.ver")
  @Get('metodos-pago')
  findAllMetodos(@CurrentSession() auth: CurrentAuth) {
    return this.metodosPagoService.findAll(auth);
  }

  @Permiso("configuracion.metodos.gestionar")
  @Post('metodos-pago')
  createMetodo(
    @CurrentSession() auth: CurrentAuth,
    @Body() payload: UpsertMetodoPagoDto,
  ) {
    return this.metodosPagoService.create(auth, payload);
  }

  @Permiso("configuracion.metodos.gestionar")
  @Post('metodos-pago/instalar-catalogo')
  instalarCatalogo(@CurrentSession() auth: CurrentAuth) {
    return this.metodosPagoService.instalarCatalogo(auth);
  }

  @Permiso("configuracion.metodos.gestionar")
  @Patch('metodos-pago/:id')
  updateMetodo(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
    @Body() payload: UpsertMetodoPagoDto,
  ) {
    return this.metodosPagoService.update(auth, id, payload);
  }

  @Permiso("configuracion.metodos.gestionar")
  @Patch('metodos-pago/:id/toggle')
  toggleMetodo(@CurrentSession() auth: CurrentAuth, @Param('id') id: string) {
    return this.metodosPagoService.toggle(auth, id);
  }

  /** Idem métodos de pago: es la cuenta a la que entra lo que se cobra. */
  @Permiso("administracion.tesoreria.ver", "administracion.cobrar.ver", "administracion.pagar.ver", "configuracion.metodos.ver", "administracion.cobrar", "administracion.egresos.ver")
  @Get('cuentas')
  listarCuentas(@CurrentSession() auth: CurrentAuth) {
    return this.metodosPagoService.listarCuentas(auth);
  }
}
