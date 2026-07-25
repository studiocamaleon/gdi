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
import { Roles } from '../auth/roles.decorator';
import { RolSistema } from '@prisma/client';
import { GastosFijosService } from './gastos-fijos.service';
import { UpsertGastoFijoDto } from './dto/upsert-gasto-fijo.dto';
import { Permiso } from '../auth/permiso.decorator';

@Permiso('costos.ver')
@Controller('gastos-fijos')
@Roles(RolSistema.ADMINISTRADOR, RolSistema.SUPERVISOR)
export class GastosFijosController {
  constructor(private readonly gastosFijos: GastosFijosService) {}

  @Get()
  listar(@CurrentSession() auth: CurrentAuth) {
    return this.gastosFijos.listar(auth);
  }

  @Permiso('costos.gestionar')
  @Post()
  crear(
    @CurrentSession() auth: CurrentAuth,
    @Body() payload: UpsertGastoFijoDto,
  ) {
    return this.gastosFijos.crear(auth, payload);
  }

  /**
   * La comparación contra la nómina real de los legajos. Es una LECTURA: no
   * cambia nada, sólo hace visible una diferencia que hasta ahora no lo era.
   */
  @Get('conciliacion-nomina')
  conciliacionNomina(
    @CurrentSession() auth: CurrentAuth,
    @Query('periodo') periodo?: string,
  ) {
    return this.gastosFijos.conciliacionNomina(auth, periodo);
  }

  /** Reemplaza las líneas de sueldos por una con la nómina de los legajos. */
  @Permiso('costos.gestionar')
  @Post('alinear-con-nomina')
  alinearConNomina(
    @CurrentSession() auth: CurrentAuth,
    @Query('periodo') periodo?: string,
  ) {
    return this.gastosFijos.alinearConNomina(auth, periodo);
  }

  @Permiso('costos.gestionar')
  @Post('importar-desde-tarifas')
  importar(@CurrentSession() auth: CurrentAuth) {
    return this.gastosFijos.importarDesdeTarifas(auth);
  }

  @Permiso('costos.gestionar')
  @Put(':id')
  actualizar(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
    @Body() payload: UpsertGastoFijoDto,
  ) {
    return this.gastosFijos.actualizar(auth, id, payload);
  }

  @Permiso('costos.gestionar')
  @Patch(':id/toggle')
  alternar(@CurrentSession() auth: CurrentAuth, @Param('id') id: string) {
    return this.gastosFijos.alternarActivo(auth, id);
  }

  @Permiso('costos.gestionar')
  @Delete(':id')
  eliminar(@CurrentSession() auth: CurrentAuth, @Param('id') id: string) {
    return this.gastosFijos.eliminar(auth, id);
  }
}
