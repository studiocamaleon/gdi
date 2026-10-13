import { BadRequestException, ConflictException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import type { CurrentAuth } from '../auth/auth.types';
import type { InventarioService } from './inventario.service';
import {
  materialPriceContext,
  materialPriceInStockUnit,
  normalizeMaterialUnit,
} from './material-units';
import {
  clavePapel,
  leerPapelDerivado,
  sobrantesDelConsumo,
  type PapelDerivado,
} from './papel-derivado';

export function planesPapel(origenes: unknown): PapelDerivado[] {
  return Array.isArray(origenes)
    ? origenes.flatMap((o) => {
        const p = leerPapelDerivado(o?.papelDerivado);
        return p ? [p] : [];
      })
    : [];
}

/** Identidad estable: evita duplicados también entre dos OTs concurrentes. */
export function idPapelCortado(
  tenantId: string,
  origenId: string,
  p: PapelDerivado,
): string {
  const h = createHash('sha256')
    .update(`papel-cortado:v1:${tenantId}:${origenId}:${clavePapel(p)}`)
    .digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

export async function conservarSobrantesPapel(
  tx: Prisma.TransactionClient,
  inventario: InventarioService,
  auth: CurrentAuth,
  entrada: {
    varianteId: string;
    ubicacionId: string;
    ordenId: string;
    origenes: unknown;
    consumida: number;
    cantidad: number;
    costoUnitario: number;
  },
) {
  const planes = planesPapel(entrada.origenes);
  if (!planes.length) return [];
  if (
    !Number.isSafeInteger(entrada.cantidad) ||
    !Number.isSafeInteger(entrada.consumida)
  )
    throw new BadRequestException(
      'El papel para corte se consume en pliegos enteros.',
    );
  const retornos = sobrantesDelConsumo(
    planes,
    entrada.consumida,
    entrada.cantidad,
  );
  const origen = await tx.materiaPrimaVariante.findFirstOrThrow({
    where: { tenantId: auth.tenantId, id: entrada.varianteId },
    include: { materiaPrima: true },
  });
  if (
    normalizeMaterialUnit(materialPriceContext(origen).unidadStock) !== 'hoja'
  )
    throw new ConflictException(
      'El papel cambió su unidad de stock. Revisá el plan de corte.',
    );
  const dims = origen.atributosVarianteJson as Prisma.JsonObject;
  for (const plan of planes) {
    if (
      Number(dims.anchoMm) !== plan.anchoOrigenMm ||
      Number(dims.largoMm ?? dims.altoMm) !== plan.altoOrigenMm
    )
      throw new ConflictException(
        'El papel cambió de medidas. Revisá el plan de corte.',
      );
  }
  const cambios: object[] = [];
  for (const { plan, hojas } of retornos) {
    const precio = materialPriceInStockUnit(
      materialPriceContext(origen),
      Number(origen.precioReferencia),
    );
    if (!precio.ok || precio.precio <= 0)
      throw new ConflictException('Revisá el precio del papel de origen.');
    const id = idPapelCortado(auth.tenantId, origen.id, plan);
    const anchoMm = Math.min(plan.anchoMm, plan.altoMm);
    const altoMm = Math.max(plan.anchoMm, plan.altoMm);
    const formato =
      anchoMm === 210 && altoMm === 297
        ? 'A4'
        : anchoMm === 297 && altoMm === 420
          ? 'A3'
          : `${anchoMm}×${altoMm} mm`;
    const atributos = {
      ...(origen.atributosVarianteJson as Prisma.JsonObject),
      anchoMm,
      altoMm,
      largoMm: altoMm,
      formatoComercial: formato,
      _papelDerivado: {
        version: 1,
        origenVarianteId: origen.id,
        rendimiento: plan.rendimiento,
      },
    };
    const existente = await tx.materiaPrimaVariante.findFirst({
      where: { tenantId: auth.tenantId, id },
    });
    const attrsExistentes = existente?.atributosVarianteJson as
      | Prisma.JsonObject
      | undefined;
    const metaExistente = attrsExistentes?._papelDerivado as
      | Prisma.JsonObject
      | undefined;
    if (!existente)
      await tx.materiaPrimaVariante.create({
        data: {
          id,
          tenantId: auth.tenantId,
          materiaPrimaId: origen.materiaPrimaId,
          sku: `CORTE-${id}`,
          nombreVariante: `${origen.nombreVariante || origen.sku} · ${formato} cortado`,
          atributosVarianteJson: atributos,
          unidadStock: 'HOJA',
          unidadUso: 'HOJA',
          unidadCompra: 'HOJA',
          unidadPrecio: 'HOJA',
          moneda: origen.moneda,
          precioReferencia: precio.precio / plan.rendimiento,
        },
      });
    else if (
      !existente.activo ||
      metaExistente?.origenVarianteId !== origen.id ||
      metaExistente?.rendimiento !== plan.rendimiento ||
      Number(attrsExistentes?.anchoMm) !== anchoMm ||
      Number(attrsExistentes?.altoMm) !== altoMm
    )
      throw new ConflictException(
        'Revisá la variante de papel cortado antes de registrar el sobrante.',
      );
    const movimiento = await inventario.registrarMovimientoTx(
      tx,
      auth,
      {
        varianteId: id,
        ubicacionId: entrada.ubicacionId,
        cantidad: hojas,
        tipo: 'ingreso',
        origen: 'consumo_produccion',
        costoUnitario: entrada.costoUnitario / plan.rendimiento,
        referenciaTipo: 'orden_trabajo',
        referenciaId: entrada.ordenId,
        notas: `Sobrante de corte: ${hojas} hojas ${formato}; origen ${origen.sku}; rendimiento ${plan.rendimiento}.`,
      } as Parameters<InventarioService['registrarMovimientoTx']>[2],
      null,
      { costoCeroExplicito: true },
    );
    cambios.push({
      varianteId: id,
      hojasRecuperadas: hojas,
      movimientoId: movimiento.movimientoId,
    });
  }
  return cambios;
}
