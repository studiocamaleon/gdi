import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { CurrentSession } from '../auth/current-auth.decorator';
import type { CurrentAuth } from '../auth/auth.types';
import { MetodosPagoService } from './metodos-pago.service';
import { CobrosService } from './cobros.service';
import { TesoreriaService } from './tesoreria.service';
import { ConfiguracionFiscalService } from './configuracion-fiscal.service';
import { UpsertMetodoPagoDto } from './dto/metodo-pago.dto';
import { CrearCobroDto } from './dto/cobro.dto';
import {
  UpsertConfiguracionFiscalDto,
  UpsertPuntoVentaDto,
} from './dto/configuracion-fiscal.dto';
import type { CondicionFiscalReceptor } from './letra-comprobante';
import {
  ArqueoDto,
  TransferenciaDto,
  UpsertCuentaFondosDto,
} from './dto/tesoreria.dto';

@Controller('administracion')
export class AdministracionController {
  constructor(
    private readonly metodosPagoService: MetodosPagoService,
    private readonly cobrosService: CobrosService,
    private readonly tesoreriaService: TesoreriaService,
    private readonly configuracionFiscalService: ConfiguracionFiscalService,
  ) {}

  // ── Configuración fiscal del emisor ──────────────────────────────────

  @Get('configuracion-fiscal')
  obtenerConfiguracionFiscal(@CurrentSession() auth: CurrentAuth) {
    return this.configuracionFiscalService.obtener(auth);
  }

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

  @Post('puntos-venta')
  crearPuntoVenta(
    @CurrentSession() auth: CurrentAuth,
    @Body() body: UpsertPuntoVentaDto,
  ) {
    return this.configuracionFiscalService.crearPuntoVenta(auth, body);
  }

  @Patch('puntos-venta/:id')
  actualizarPuntoVenta(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
    @Body() body: UpsertPuntoVentaDto,
  ) {
    return this.configuracionFiscalService.actualizarPuntoVenta(auth, id, body);
  }

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
  ) {
    return this.tesoreriaService.movimientos(auth, id);
  }

  @Post('cuentas/transferencias')
  transferir(
    @CurrentSession() auth: CurrentAuth,
    @Body() payload: TransferenciaDto,
  ) {
    return this.tesoreriaService.transferir(auth, payload);
  }

  @Post('cuentas/:id/arqueo')
  arqueo(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
    @Body() payload: ArqueoDto,
  ) {
    return this.tesoreriaService.arqueo(auth, id, payload);
  }

  // ── Cobros ───────────────────────────────────────────────────────────

  @Get('cobros')
  cobros(
    @CurrentSession() auth: CurrentAuth,
    @Query('ordenId') ordenId?: string,
  ) {
    return this.cobrosService.findAll(auth, { ordenId });
  }

  @Post('cobros')
  crearCobro(
    @CurrentSession() auth: CurrentAuth,
    @Body() payload: CrearCobroDto,
  ) {
    return this.cobrosService.create(auth, payload);
  }

  @Post('cobros/:id/acreditar')
  acreditarCobro(@CurrentSession() auth: CurrentAuth, @Param('id') id: string) {
    return this.cobrosService.acreditar(auth, id);
  }

  @Get('metodos-pago')
  findAllMetodos(@CurrentSession() auth: CurrentAuth) {
    return this.metodosPagoService.findAll(auth);
  }

  @Post('metodos-pago')
  createMetodo(
    @CurrentSession() auth: CurrentAuth,
    @Body() payload: UpsertMetodoPagoDto,
  ) {
    return this.metodosPagoService.create(auth, payload);
  }

  @Post('metodos-pago/instalar-catalogo')
  instalarCatalogo(@CurrentSession() auth: CurrentAuth) {
    return this.metodosPagoService.instalarCatalogo(auth);
  }

  @Patch('metodos-pago/:id')
  updateMetodo(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
    @Body() payload: UpsertMetodoPagoDto,
  ) {
    return this.metodosPagoService.update(auth, id, payload);
  }

  @Patch('metodos-pago/:id/toggle')
  toggleMetodo(@CurrentSession() auth: CurrentAuth, @Param('id') id: string) {
    return this.metodosPagoService.toggle(auth, id);
  }

  @Get('cuentas')
  listarCuentas(@CurrentSession() auth: CurrentAuth) {
    return this.metodosPagoService.listarCuentas(auth);
  }
}
