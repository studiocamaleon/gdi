import { Type } from 'class-transformer';
import { Body, Controller, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  IsNumber,
  Min,
  Max,
  ValidateNested,
  Matches,
} from 'class-validator';
import { Permiso, RequiereVista } from '../../auth/permiso.decorator';
import { CurrentSession } from '../../auth/current-auth.decorator';
import type { CurrentAuth } from '../../auth/auth.types';
import { ORDEN_CANALES_VENTA } from '../../ordenes-trabajo/canales-venta';
import { CapacidadesEmpresaService } from '../../suscripciones/capacidades-empresa.service';
import { CentroCopiadoPedidosService } from './centro-copiado-pedidos.service';
export class DescuentoPedidoCopiadoDto {
  @IsUUID() cotizacionItemId!: string;
  @IsIn(['PORCENTAJE', 'MONTO']) tipo!: 'PORCENTAJE' | 'MONTO';
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(999999999999) valor!: number;
}
export class RevisarPedidoDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => DescuentoPedidoCopiadoDto)
  descuentos?: DescuentoPedidoCopiadoDto[];
  @IsIn(ORDEN_CANALES_VENTA) canalVenta!: string;
  @IsOptional() @IsUUID() clienteId?: string;
  @IsIn(['FISCAL', 'SIN_COMPROBANTE']) tratamientoFiscal!:
    | 'FISCAL'
    | 'SIN_COMPROBANTE';
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  items!: string[];
}
export class AutorizarMargenCopiadoDto {
  @IsString() @Length(10, 1000) motivo!: string;
  @IsString() @Matches(/^[a-f0-9]{64}$/) huella!: string;
}
@Controller('centro-copiado/pedidos')
@Permiso('comercial.copiado.ver')
export class CentroCopiadoPedidosController {
  constructor(
    private readonly pedidos: CentroCopiadoPedidosService,
    private readonly capacidades: CapacidadesEmpresaService,
  ) {}
  @Post('revisar')
  @Permiso('comercial.copiado.gestionar')
  async revisar(
    @CurrentSession() auth: CurrentAuth,
    @Body() dto: RevisarPedidoDto,
  ) {
    await this.capacidades.exigirTodas(auth.tenantId, [
      'cotizacion',
      'centro_copiado',
    ]);
    return this.pedidos.revisar(auth, dto);
  }
  @Post('estado')
  async estado(
    @CurrentSession() auth: CurrentAuth,
    @Body() dto: RevisarPedidoDto,
  ) {
    await this.capacidades.exigirIncluida(auth.tenantId, 'centro_copiado');
    return this.pedidos.estado(auth, dto);
  }
  @Post(':id/autorizar-margen')
  @Permiso('comercial.aprobar_descuento')
  @RequiereVista('comercial.copiado.ver')
  async autorizar(
    @CurrentSession() auth: CurrentAuth,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AutorizarMargenCopiadoDto,
  ) {
    await this.capacidades.exigirIncluida(auth.tenantId, 'centro_copiado');
    return this.pedidos.autorizar(auth, id, dto.motivo, dto.huella);
  }
}
