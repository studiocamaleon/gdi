import {
  Body,
  Controller,
  Delete,
  Get,
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
import { AnularCobroDto, CrearCobroDto } from './dto/cobro.dto';
import {
  CargarCaeDto,
  CrearComprobanteDto,
  FacturarLoteDto,
  FacturarOrdenDto,
  NotaCreditoOrdenDto,
  ImputarCobroDto,
} from './dto/comprobante.dto';
import { FacturacionOrdenesService } from './facturacion-ordenes.service';
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
import { Permiso } from '../auth/permiso.decorator';

@Permiso('administracion.ver')
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
  factura(@CurrentSession() auth: CurrentAuth, @Param('id') id: string) {
    return this.facturaService.documento(auth.tenantId, id);
  }

  // ── Cuenta corriente ─────────────────────────────────────────────────

  @Get('deudores')
  deudores(@CurrentSession() auth: CurrentAuth) {
    return this.cuentaCorrienteService.deudores(auth);
  }

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
  @Get('clientes/:clienteId/cuenta-corriente/pdf')
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

  @Get('comprobantes')
  listarComprobantes(
    @CurrentSession() auth: CurrentAuth,
    @Query('estado') estado?: string,
    @Query('tipo') tipo?: string,
    @Query('clienteId') clienteId?: string,
    @Query('ordenId') ordenId?: string,
    @Query('q') q?: string,
  ) {
    return this.comprobantesService.listar(auth, {
      estado,
      tipo,
      clienteId,
      ordenId,
      q,
    });
  }

  // ── Facturación sobre órdenes ────────────────────────────────────────

  // ── Integración AFIP (facturación electrónica por delegación) ────────
  // Ver docs/integracion-afip-delegacion-diseno.md

  @Get('afip')
  afip(@CurrentSession() auth: CurrentAuth) {
    return this.afipIntegracion.obtener(auth);
  }

  /** Verifica la delegación sin encender nada (chequeo en seco). */
  @ProhibidoImpersonando()
  @Permiso('administracion.gestionar')
  @Post('afip/verificar')
  verificarAfip(@CurrentSession() auth: CurrentAuth) {
    return this.afipIntegracion.verificar(auth);
  }

  /** Enciende la facturación: verifica y, si pasa, activa. */
  @ProhibidoImpersonando()
  @Permiso('administracion.gestionar')
  @Post('afip/activar')
  activarAfip(@CurrentSession() auth: CurrentAuth) {
    return this.afipIntegracion.activar(auth);
  }

  @ProhibidoImpersonando()
  @Permiso('administracion.gestionar')
  @Post('afip/desactivar')
  desactivarAfip(@CurrentSession() auth: CurrentAuth) {
    return this.afipIntegracion.desactivar(auth);
  }

  /** El gate del botón Facturar. Liviano: sólo el booleano. */
  @Get('facturacion/estado')
  async estadoFacturacion() {
    return { habilitada: await this.afipIntegracion.facturacionHabilitada() };
  }

  /** Órdenes finalizadas con saldo sin facturar (vista Facturación). */
  @Get('facturacion/pendientes')
  pendientesFacturacion(@CurrentSession() auth: CurrentAuth) {
    return this.facturacionOrdenesService.pendientesFacturacion(auth.tenantId);
  }

  /**
   * Nota de crédito contra una factura de la orden. Pide `administracion.anular`
   * —no `gestionar`— porque es la operación que DESHACE: emitir factura y
   * anularla son dos permisos distintos, igual que descartar un comprobante.
   */
  @Permiso('administracion.anular')
  @Post('ordenes/:ordenId/nota-credito')
  notaCreditoOrden(
    @CurrentSession() auth: CurrentAuth,
    @Param('ordenId') ordenId: string,
    @Body() body: NotaCreditoOrdenDto,
  ) {
    return this.comprobantesService.notaCreditoDeOrden(auth, ordenId, body);
  }

  /** Facturar (parcial o total) una orden desde su ficha. */
  @Permiso('administracion.gestionar')
  @Post('ordenes/:ordenId/facturar')
  facturarOrden(
    @CurrentSession() auth: CurrentAuth,
    @Param('ordenId') ordenId: string,
    @Body() body: FacturarOrdenDto,
  ) {
    return this.comprobantesService.facturarOrden(auth, ordenId, body);
  }

  /** Facturar un lote de órdenes (N facturas o una agrupada). */
  @Permiso('administracion.gestionar')
  @Post('facturacion/lote')
  facturarLote(
    @CurrentSession() auth: CurrentAuth,
    @Body() body: FacturarLoteDto,
  ) {
    return this.comprobantesService.facturarLote(auth, body);
  }

  @Get('comprobantes/:id')
  obtenerComprobante(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
  ) {
    return this.comprobantesService.obtener(auth, id);
  }

  @Permiso('administracion.gestionar')
  @Post('comprobantes')
  crearComprobante(
    @CurrentSession() auth: CurrentAuth,
    @Body() body: CrearComprobanteDto,
  ) {
    return this.comprobantesService.crear(auth, body);
  }

  @Permiso('administracion.gestionar')
  @Post('comprobantes/:id/emitir')
  emitirComprobante(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
  ) {
    return this.comprobantesService.emitir(auth, id);
  }

  @Permiso('administracion.gestionar')
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
  @Permiso('administracion.anular')
  @Delete('comprobantes/:id')
  descartarComprobante(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
  ) {
    return this.comprobantesService.descartar(auth, id);
  }

  // ── Imputaciones ─────────────────────────────────────────────────────

  @Get('clientes/:clienteId/comprobantes-pendientes')
  comprobantesPendientes(
    @CurrentSession() auth: CurrentAuth,
    @Param('clienteId') clienteId: string,
  ) {
    return this.imputacionesService.pendientesDeCliente(auth, clienteId);
  }

  @Permiso('administracion.gestionar')
  @Post('cobros/:id/imputaciones')
  imputarCobro(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
    @Body() body: ImputarCobroDto,
  ) {
    return this.imputacionesService.imputar(auth, id, body);
  }

  @Permiso('administracion.gestionar')
  @Delete('imputaciones/:id')
  quitarImputacion(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
  ) {
    return this.imputacionesService.quitar(auth, id);
  }

  // ── Configuración fiscal del emisor ──────────────────────────────────

  @Get('configuracion-fiscal')
  obtenerConfiguracionFiscal(@CurrentSession() auth: CurrentAuth) {
    return this.configuracionFiscalService.obtener(auth);
  }

  @Permiso('administracion.gestionar')
  @Put('configuracion-fiscal')
  guardarConfiguracionFiscal(
    @CurrentSession() auth: CurrentAuth,
    @Body() body: UpsertConfiguracionFiscalDto,
  ) {
    return this.configuracionFiscalService.guardar(auth, body);
  }

  @Get('configuracion-fiscal/letra')
  letraSugerida(
    @CurrentSession() auth: CurrentAuth,
    @Query('receptor') receptor: CondicionFiscalReceptor,
  ) {
    return this.configuracionFiscalService.letraPara(auth, receptor);
  }

  @Permiso('administracion.gestionar')
  @Post('puntos-venta')
  crearPuntoVenta(
    @CurrentSession() auth: CurrentAuth,
    @Body() body: UpsertPuntoVentaDto,
  ) {
    return this.configuracionFiscalService.crearPuntoVenta(auth, body);
  }

  @Permiso('administracion.gestionar')
  @Patch('puntos-venta/:id')
  actualizarPuntoVenta(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
    @Body() body: UpsertPuntoVentaDto,
  ) {
    return this.configuracionFiscalService.actualizarPuntoVenta(auth, id, body);
  }

  @Permiso('administracion.gestionar')
  @Delete('puntos-venta/:id')
  eliminarPuntoVenta(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
  ) {
    return this.configuracionFiscalService.eliminarPuntoVenta(auth, id);
  }

  // ── Tesorería ────────────────────────────────────────────────────────

  @Get('tesoreria')
  resumenTesoreria(@CurrentSession() auth: CurrentAuth) {
    return this.tesoreriaService.resumen(auth);
  }

  @Permiso('administracion.gestionar')
  @Post('cuentas')
  crearCuenta(
    @CurrentSession() auth: CurrentAuth,
    @Body() payload: UpsertCuentaFondosDto,
  ) {
    return this.tesoreriaService.crearCuenta(auth, payload);
  }

  @Get('cuentas/:id/movimientos')
  movimientosCuenta(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
    @Query() filtros: MovimientosFondosQueryDto,
  ) {
    return this.tesoreriaService.movimientos(auth, id, filtros);
  }

  @Permiso('administracion.gestionar')
  @Patch('cuentas/:id')
  editarCuenta(
    @CurrentSession() auth: CurrentAuth,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() payload: EditarCuentaFondosDto,
  ) {
    return this.tesoreriaService.editarCuenta(auth, id, payload);
  }

  @Permiso('administracion.gestionar')
  @Post('cuentas/transferencias')
  transferir(
    @CurrentSession() auth: CurrentAuth,
    @Body() payload: TransferenciaDto,
  ) {
    return this.tesoreriaService.transferir(auth, payload);
  }

  @Permiso('administracion.gestionar')
  @Post('cuentas/:id/arqueo')
  arqueo(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
    @Body() payload: ArqueoDto,
  ) {
    return this.tesoreriaService.arqueo(auth, id, payload);
  }

  @Permiso('administracion.gestionar')
  @Post('cuentas/:id/ajustes')
  ajustarFondos(
    @CurrentSession() auth: CurrentAuth,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() payload: AjusteFondosDto,
  ) {
    return this.tesoreriaService.ajustar(auth, id, payload);
  }

  @Permiso('administracion.gestionar')
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

  @Get('valores')
  valores(@CurrentSession() auth: CurrentAuth) {
    return this.tesoreriaService.valores(auth);
  }

  @Permiso('administracion.gestionar')
  @Post('valores/:id/depositar')
  depositarValor(
    @CurrentSession() auth: CurrentAuth,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() payload: DepositarValorDto,
  ) {
    return this.tesoreriaService.depositarValor(auth, id, payload);
  }

  @Permiso('administracion.gestionar')
  @Post('valores/:id/acreditar')
  acreditarValor(
    @CurrentSession() auth: CurrentAuth,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() payload: AcreditarValorDto,
  ) {
    return this.tesoreriaService.acreditarValor(auth, id, payload);
  }

  @Permiso('administracion.anular')
  @Post('valores/:id/revertir-deposito')
  revertirDepositoValor(
    @CurrentSession() auth: CurrentAuth,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() payload: RevertirOperacionValorDto,
  ) {
    return this.tesoreriaService.revertirDepositoValor(auth, id, payload);
  }

  @Permiso('administracion.anular')
  @Post('valores/:id/revertir-acreditacion')
  revertirAcreditacionValor(
    @CurrentSession() auth: CurrentAuth,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() payload: RevertirOperacionValorDto,
  ) {
    return this.tesoreriaService.revertirAcreditacionValor(auth, id, payload);
  }

  @Permiso('administracion.anular')
  @Post('valores/:id/rechazar')
  rechazarValor(
    @CurrentSession() auth: CurrentAuth,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() payload: RechazarValorDto,
  ) {
    return this.tesoreriaService.rechazarValor(auth, id, payload);
  }

  // ── Cobros ───────────────────────────────────────────────────────────

  @Get('cobros')
  cobros(
    @CurrentSession() auth: CurrentAuth,
    @Query('ordenId') ordenId?: string,
  ) {
    return this.cobrosService.findAll(auth, { ordenId });
  }

  @Get('cobros/pendientes-acreditacion')
  cobrosPendientesAcreditacion(@CurrentSession() auth: CurrentAuth) {
    return this.cobrosService.pendientesAcreditacion(auth);
  }

  // También el Vendedor: la seña se toma al cerrar la venta, no en la caja.
  @Permiso('administracion.gestionar', 'administracion.cobrar')
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
  @Get('cobros/:id/recibo/pdf')
  async pdfRecibo(
    @CurrentSession() auth: CurrentAuth,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ): Promise<void> {
    const archivo = await this.recibosService.pdfDe(id, auth.tenantId);
    res.redirect(302, await this.archivos.urlDeDescarga(archivo.id));
  }

  /** El link que se comparte con el cliente (`/c/<token>`), si ya se emitió. */
  @Get('cobros/:id/recibo/enlace')
  async enlaceRecibo(
    @CurrentSession() auth: CurrentAuth,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    void auth;
    return { url: await this.recibosService.urlPublica(id) };
  }

  @Permiso('administracion.gestionar')
  @Post('cobros/:id/acreditar')
  acreditarCobro(@CurrentSession() auth: CurrentAuth, @Param('id') id: string) {
    return this.cobrosService.acreditar(auth, id);
  }

  @Permiso('administracion.anular')
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
  @Permiso('administracion.ver', 'administracion.cobrar')
  @Get('metodos-pago')
  findAllMetodos(@CurrentSession() auth: CurrentAuth) {
    return this.metodosPagoService.findAll(auth);
  }

  @Permiso('administracion.gestionar')
  @Post('metodos-pago')
  createMetodo(
    @CurrentSession() auth: CurrentAuth,
    @Body() payload: UpsertMetodoPagoDto,
  ) {
    return this.metodosPagoService.create(auth, payload);
  }

  @Permiso('administracion.gestionar')
  @Post('metodos-pago/instalar-catalogo')
  instalarCatalogo(@CurrentSession() auth: CurrentAuth) {
    return this.metodosPagoService.instalarCatalogo(auth);
  }

  @Permiso('administracion.gestionar')
  @Patch('metodos-pago/:id')
  updateMetodo(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
    @Body() payload: UpsertMetodoPagoDto,
  ) {
    return this.metodosPagoService.update(auth, id, payload);
  }

  @Permiso('administracion.gestionar')
  @Patch('metodos-pago/:id/toggle')
  toggleMetodo(@CurrentSession() auth: CurrentAuth, @Param('id') id: string) {
    return this.metodosPagoService.toggle(auth, id);
  }

  /** Idem métodos de pago: es la cuenta a la que entra lo que se cobra. */
  @Permiso('administracion.ver', 'administracion.cobrar')
  @Get('cuentas')
  listarCuentas(@CurrentSession() auth: CurrentAuth) {
    return this.metodosPagoService.listarCuentas(auth);
  }
}
