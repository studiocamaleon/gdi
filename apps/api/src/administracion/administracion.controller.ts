import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentSession } from '../auth/current-auth.decorator';
import type { CurrentAuth } from '../auth/auth.types';
import { MetodosPagoService } from './metodos-pago.service';
import { CobrosService } from './cobros.service';
import { TesoreriaService } from './tesoreria.service';
import { UpsertMetodoPagoDto } from './dto/metodo-pago.dto';
import { CrearCobroDto } from './dto/cobro.dto';
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
  ) {}

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
