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

/*
  Permiso `administracion.configurar` y no `costos.*`.

  Acá vive lo que la empresa gasta por mes: la nómina, el alquiler, el
  estudio contable, las refinanciaciones. Es información administrativa, no de
  producción — y ningún precio la usa: el cotizador no lee esta tabla, las
  tarifas de máquina salen de los centros de costo. Lo único que la consume es
  el punto de equilibrio (un reporte) y el puente con los egresos recurrentes.

  El cambio de permiso es deliberado y tiene consecuencias en las dos
  direcciones: el Jefe de producción DEJA de ver la masa salarial —no la
  necesita— y el Administrativo, que es quien carga estos números, PASA a
  poder hacerlo. Antes no podía: no tenía `costos.ver`.
*/
@Permiso('administracion.configurar')
@Controller('gastos-fijos')
@Roles(RolSistema.ADMINISTRADOR, RolSistema.SUPERVISOR)
export class GastosFijosController {
  constructor(private readonly gastosFijos: GastosFijosService) {}

  @Get()
  listar(@CurrentSession() auth: CurrentAuth) {
    return this.gastosFijos.listar(auth);
  }

  @Permiso('administracion.configurar')
  @Post()
  crear(
    @CurrentSession() auth: CurrentAuth,
    @Body() payload: UpsertGastoFijoDto,
  ) {
    return this.gastosFijos.crear(auth, payload);
  }




  @Permiso('administracion.configurar')
  @Put(':id')
  actualizar(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
    @Body() payload: UpsertGastoFijoDto,
  ) {
    return this.gastosFijos.actualizar(auth, id, payload);
  }

  @Permiso('administracion.configurar')
  @Patch(':id/toggle')
  alternar(@CurrentSession() auth: CurrentAuth, @Param('id') id: string) {
    return this.gastosFijos.alternarActivo(auth, id);
  }

  @Permiso('administracion.configurar')
  @Delete(':id')
  eliminar(@CurrentSession() auth: CurrentAuth, @Param('id') id: string) {
    return this.gastosFijos.eliminar(auth, id);
  }
}
