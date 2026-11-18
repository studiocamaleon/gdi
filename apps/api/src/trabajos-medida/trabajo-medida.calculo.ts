import { BadRequestException } from '@nestjs/common';
import Decimal from 'decimal.js';
import type { TrabajoMedidaDto } from './trabajo-medida.dto';
import type {
  ImpuestoSnapshot,
  ComisionSnapshot,
} from '../productos-servicios/precio/aplicar-precio.types';

/** Precio pactado: ninguna carga interna hace gross-up ni cambia ese precio. */
export function calcularTrabajoMedida(
  dto: TrabajoMedidaDto,
  tarifas: Map<string, number>,
  impuestos: ImpuestoSnapshot[],
  comisiones: ComisionSnapshot[],
  decimales: number,
) {
  const r = (v: Decimal.Value) =>
    new Decimal(v).toDecimalPlaces(decimales).toNumber();
  const operaciones = dto.operaciones.map((o) => {
    if (o.horas != null && o.horas > 0 && !o.centroCostoId)
      throw new BadRequestException(
        `Elegí el centro de costo para las horas de «${o.nombre}».`,
      );
    const tarifa = o.centroCostoId ? tarifas.get(o.centroCostoId) : 0;
    if (o.centroCostoId && tarifa == null)
      throw new BadRequestException(
        `El centro de «${o.nombre}» no tiene una tarifa vigente publicada.`,
      );
    return {
      ...o,
      tarifaHora: tarifa ?? 0,
      costo: r(new Decimal(o.horas ?? 0).mul(tarifa ?? 0)),
    };
  });
  let materiales = r(dto.costos.materiales);
  let otros = r(Decimal.sum(0, ...dto.costos.otros.map((o) => o.costo)));
  const horas = r(Decimal.sum(0, ...operaciones.map((o) => o.costo)));
  if (dto.costos.modo === 'TOTAL') {
    if (
      dto.costos.totalEstimado == null ||
      !Number.isFinite(dto.costos.totalEstimado)
    )
      throw new BadRequestException('Ingresá el costo total aproximado.');
    if (r(dto.costos.totalEstimado) < horas)
      throw new BadRequestException(
        'El costo total aproximado debe incluir al menos el costo de las horas cargadas.',
      );
    materiales = 0;
    otros = r(new Decimal(dto.costos.totalEstimado).sub(horas));
  }
  const costo = r(new Decimal(materiales).add(otros).add(horas));
  const externosPct = impuestos
    .filter((i) => i.traslado === 'POR_FUERA')
    .reduce((s, i) => s + i.porcentaje, 0);
  if (
    impuestos.some(
      (i) => i.traslado === 'POR_FUERA' && i.baseCalculo === 'BRUTO_COBRADO',
    )
  )
    throw new BadRequestException(
      'Los impuestos agregados al cliente deben calcularse sobre el neto. Revisá la configuración.',
    );
  const pactado = new Decimal(dto.precio).mul(
    dto.basePrecio === 'UNITARIO' ? dto.cantidad : 1,
  );
  const factor = new Decimal(1).add(new Decimal(externosPct).div(100));
  const netoLista = dto.tipoPrecio === 'FINAL' ? pactado.div(factor) : pactado;
  let descuento = new Decimal(0);
  if (dto.descuento) {
    if (dto.descuento.tipo === 'PORCENTAJE' && dto.descuento.valor > 100)
      throw new BadRequestException('El descuento no puede superar el 100%.');
    descuento =
      dto.descuento.tipo === 'PORCENTAJE'
        ? netoLista.mul(dto.descuento.valor).div(100)
        : new Decimal(dto.descuento.valor);
    if (descuento.gt(netoLista))
      throw new BadRequestException('El descuento supera el precio neto.');
  }
  const netoExacto = netoLista.sub(descuento);
  const total = r(
    dto.tipoPrecio === 'FINAL' && descuento.isZero()
      ? pactado
      : netoExacto.mul(factor),
  );
  const neto = r(netoExacto);
  const iva = r(new Decimal(total).sub(neto));
  const porcentaje = (p: { porcentaje: number; baseCalculo?: string }) =>
    new Decimal(p.baseCalculo === 'BRUTO_COBRADO' ? total : neto)
      .mul(p.porcentaje)
      .div(100);
  const internos = r(
    Decimal.sum(
      0,
      ...impuestos.filter((i) => i.traslado !== 'POR_FUERA').map(porcentaje),
    ),
  );
  const comision = r(Decimal.sum(0, ...comisiones.map(porcentaje)));
  const variables = r(
    new Decimal(materiales).add(otros).add(internos).add(comision),
  );
  const margen = r(new Decimal(neto).sub(costo).sub(internos).sub(comision));
  const contribucion = r(new Decimal(neto).sub(variables));
  if (
    [costo, total, neto, variables].some(
      (n) => !Number.isFinite(n) || Math.abs(n) >= 1e12,
    )
  )
    throw new BadRequestException('Los importes superan el máximo permitido.');
  return {
    operaciones,
    materiales,
    otros,
    horas,
    costo,
    total,
    neto,
    iva,
    internos,
    comision,
    variables,
    margen,
    contribucion,
    descuento: r(descuento),
    netoLista: r(netoLista),
  };
}
