import {
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import {
  Prisma,
  type CotizacionItem,
  type CentroCopiadoPedidoCalculo,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { CurrentAuth } from '../../auth/auth.types';
import { CentroCopiadoPoliticaService } from '../tarifarios/centro-copiado-politica.service';
import { CentroCopiadoAuditoriaService } from '../centro-copiado-auditoria.service';
import {
  mismaReferenciaPolitica,
  type ReferenciaPoliticaPrecios,
} from '../tarifarios/politica-precios';
import { DecimalComercial as D } from '../comercial/validaciones';
import {
  calculoDe,
  canonico,
  esCopiado,
  firmaItemsCopiado,
} from './snapshot-pedido';
import type {
  ContextoEmisionCopiado,
  ResultadoGuardado,
} from './centro-copiado-pedidos.service';
const firma = firmaItemsCopiado;
@Injectable()
export class CentroCopiadoEmisionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly politica: CentroCopiadoPoliticaService = new CentroCopiadoPoliticaService(
      prisma,
      new CentroCopiadoAuditoriaService(prisma),
    ),
  ) {}
  async verificar(
    tx: Prisma.TransactionClient,
    tenantId: string,
    c: CentroCopiadoPedidoCalculo,
    items: CotizacionItem[],
    contexto: ContextoEmisionCopiado,
  ) {
    // El motor toma este mismo lock al recotizar: comprobar después del lock.
    await tx.$queryRaw`SELECT "id" FROM "Cotizacion" WHERE "tenantId" = ${tenantId}::uuid AND "id" = ${c.cotizacionId}::uuid FOR UPDATE`;
    const actuales = await tx.cotizacionItem.findMany({
      where: { tenantId, id: { in: items.map((i) => i.id) } },
    });
    if (firma(actuales) !== c.huella)
      throw new ConflictException(
        'El cálculo de copiado cambió. Revisá los precios antes de emitir.',
      );
    const r = c.resultadoJson as unknown as ResultadoGuardado;
    if (
      c.clienteId !== (contexto.clienteId ?? null) ||
      c.canalVenta !== contexto.canalVenta ||
      c.tratamientoFiscal !== (contexto.tratamientoFiscal ?? 'FISCAL') ||
      canonico([...r.ids].sort()) !== canonico(items.map((i) => i.id).sort()) ||
      firma(items) !== c.huella
    )
      throw new ConflictException(
        'Cambió el pedido, el canal o su cálculo. Actualizá los precios de copiado antes de emitir.',
      );
    const actual = await this.politica.resolverActiva(
      tenantId,
      contexto.canalVenta,
      tx,
    );
    if (
      actual.estado !== 'TARIFARIO' ||
      !mismaReferenciaPolitica(
        c.referenciaJson as unknown as ReferenciaPoliticaPrecios,
        actual.referencia,
      )
    )
      throw new ConflictException(
        'Hay una nueva política o versión de precios. Revisá y actualizá el borrador antes de emitir.',
      );
    for (const item of items) {
      const final = contexto.items.find((i) => i.cotizacionItemId === item.id);
      if (
        !final ||
        !new D(final.subtotal.toString()).eq(
          item.precioNetoTotal!.toString(),
        ) ||
        !new D(final.total.toString()).eq(item.precioTotal!.toString())
      )
        throw new ConflictException(
          'Un ajuste posterior cambió el importe de copiado. Revisá el descuento o canje y actualizá sus precios antes de emitir.',
        );
    }
    return r;
  }

  /** Único gate de órdenes directas, salida de borrador y envío de presupuesto.
   * Debe ejecutarse dentro de la transacción que emite, antes de efectos externos. */
  async exigirEmitibleTx(
    tx: Prisma.TransactionClient,
    auth: CurrentAuth,
    contexto: ContextoEmisionCopiado,
  ) {
    const ids = contexto.items.flatMap((i) =>
      i.cotizacionItemId ? [i.cotizacionItemId] : [],
    );
    const todos = await tx.cotizacionItem.findMany({
      where: { tenantId: auth.tenantId, id: { in: ids } },
      include: { producto: { select: { codigo: true } } },
    });
    const items = todos
      .filter((i) => esCopiado(i) || i.producto.codigo === 'SYS-IMPRESION-DOC')
      .map(({ producto: _p, ...i }) => {
        void _p;
        return i;
      });
    if (!items.length) return;
    await this.politica.bloquear(tx, auth.tenantId);
    const activa = await this.politica.resolverActiva(
      auth.tenantId,
      contexto.canalVenta,
      tx,
    );
    if (activa.estado === 'MOTOR' && items.every((i) => !calculoDe(i))) return;
    const calculos = [...new Set(items.map(calculoDe))];
    if (calculos.length !== 1 || !calculos[0])
      throw new ConflictException(
        'Actualizá los precios de todas las cargas de copiado del pedido antes de emitir.',
      );
    const c = await tx.centroCopiadoPedidoCalculo.findFirst({
      where: { id: calculos[0], tenantId: auth.tenantId },
    });
    if (!c)
      throw new ConflictException(
        'Falta una revisión válida de precios de copiado.',
      );
    const r = await this.verificar(tx, auth.tenantId, c, items, contexto);
    const controles = [r.control, ...r.terminaciones.map((t) => t.control)];
    if (
      r.estado === 'PRECIO_PENDIENTE' ||
      controles.some((c) => c.estado === 'NO_VERIFICABLE')
    )
      throw new ConflictException(
        'Faltan precios o costos verificables de copiado. Revisalos antes de emitir.',
      );
    if (controles.some((c) => c.estado === 'BLOQUEADO'))
      throw new ConflictException(
        'El margen de copiado está debajo del mínimo y el tarifario bloquea la emisión. Ajustá el precio.',
      );
    if (
      controles.some((c) => c.estado === 'REQUIERE_AUTORIZACION') &&
      !c.autorizadoEl
    )
      throw new ForbiddenException(
        'El margen de copiado requiere una autorización explícita con motivo antes de emitir.',
      );
  }
}
