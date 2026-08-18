import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const r2 = (n: number) => Math.round(n * 100) / 100;
/** Tolerancia de redondeo de los agregados (centavo). */
const EPS = 0.01;

/**
 * Motor del vínculo factura↔orden y del matching cobro↔factura.
 *
 * La deuda del cliente es COMERCIAL: nace de la orden al finalizar
 * (total − cobrado). Lo fiscal (facturas) es una capa opcional paralela
 * que "sigue" a la orden, y el usuario nunca imputa a mano: acá corre el
 * matching automático bidireccional FIFO — al registrar un cobro se
 * cancelan las facturas impagas de su orden, y al emitir una factura se
 * absorben los cobros libres de sus órdenes. En una factura de VARIAS
 * órdenes (lote), los cobros de cada orden sólo cancelan hasta la porción
 * de esa orden en la factura.
 *
 * Todos los métodos con `tx` corren dentro de la transacción del caller,
 * junto con los denormalizados que tocan (facturadoTotal, cobradoTotal,
 * saldoPendiente) — mismo patrón que Comprobante.saldoPendiente.
 * Ver docs/facturacion-ordenes-deuda-comercial-diseno.md §5.
 */
@Injectable()
export class FacturacionOrdenesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Recalcula el facturadoTotal de una orden desde sus vínculos: facturas
   * suman, notas de crédito restan; sólo comprobantes EMITIDOS y no
   * anulados (un borrador no cuenta ni reserva cupo). Piso 0.
   */
  async recalcularFacturado(
    tx: Prisma.TransactionClient,
    tenantId: string,
    ordenId: string,
  ): Promise<number> {
    const vinculos = await tx.comprobanteOrden.findMany({
      where: { tenantId, ordenId },
      select: {
        monto: true,
        comprobante: { select: { tipo: true, estado: true, anuladoEl: true } },
      },
    });
    const facturado = Math.max(
      0,
      r2(
        vinculos.reduce((suma, v) => {
          if (v.comprobante.estado !== 'emitido' || v.comprobante.anuladoEl) {
            return suma;
          }
          if (v.comprobante.tipo === 'factura') return suma + Number(v.monto);
          if (v.comprobante.tipo === 'nota_credito') {
            return suma - Number(v.monto);
          }
          return suma;
        }, 0),
      ),
    );
    await tx.ordenTrabajo.update({
      where: { id: ordenId },
      data: { facturadoTotal: facturado },
    });
    return facturado;
  }

  /** Recalcula el cobradoTotal de una orden (bruto de cobros no anulados). */
  async recalcularCobrado(
    tx: Prisma.TransactionClient,
    tenantId: string,
    ordenId: string,
  ): Promise<number> {
    const [aplicado, directosSinAplicacion] = await Promise.all([
      tx.cobroOrden.aggregate({
        where: { tenantId, ordenId, cobro: { anuladoEl: null } },
        _sum: { monto: true },
      }),
      // Compatibilidad defensiva para datos creados antes de la migración o
      // fixtures que todavía construyen el cobro directo a mano.
      tx.cobro.aggregate({
        where: {
          tenantId,
          ordenId,
          anuladoEl: null,
          aplicacionesOrden: { none: { ordenId } },
        },
        _sum: { montoBruto: true },
      }),
    ]);
    const cobrado = r2(
      Number(aplicado._sum.monto ?? 0) +
        Number(directosSinAplicacion._sum.montoBruto ?? 0),
    );
    await tx.ordenTrabajo.update({
      where: { id: ordenId },
      data: { cobradoTotal: cobrado },
    });
    return cobrado;
  }

  /**
   * Distribuye comercialmente un cobro. Si vino desde una OT conserva esa
   * intención; si vino desde la cuenta corriente aplica FIFO por vencimiento.
   * El sobrante no se fuerza: queda como anticipo del cliente.
   */
  async aplicarCobroComercial(
    tx: Prisma.TransactionClient,
    tenantId: string,
    cobroId: string,
  ): Promise<Array<{ ordenId: string; monto: number }>> {
    const cobro = await tx.cobro.findFirst({
      where: { id: cobroId, tenantId, anuladoEl: null },
      include: {
        aplicacionesOrden: { select: { ordenId: true, monto: true } },
      },
    });
    if (!cobro) return [];
    if (cobro.aplicacionesOrden.length > 0) {
      return cobro.aplicacionesOrden.map((a) => ({
        ordenId: a.ordenId,
        monto: Number(a.monto),
      }));
    }

    if (cobro.ordenId) {
      const bloqueada = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT "id"
        FROM "OrdenTrabajo"
        WHERE "id" = ${cobro.ordenId}::uuid AND "tenantId" = ${tenantId}::uuid
        FOR UPDATE
      `);
      if (bloqueada.length === 0) return [];
      const monto = Number(cobro.montoBruto);
      await tx.cobroOrden.create({
        data: { tenantId, cobroId, ordenId: cobro.ordenId, monto },
      });
      await this.recalcularCobrado(tx, tenantId, cobro.ordenId);
      return [{ ordenId: cobro.ordenId, monto }];
    }
    if (!cobro.clienteId) return [];

    const ids = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id"
      FROM "OrdenTrabajo"
      WHERE "tenantId" = ${tenantId}::uuid
        AND "clienteId" = ${cobro.clienteId}::uuid
        AND "estado" IN ('finalizada', 'entregada')
        AND COALESCE("total", 0) > COALESCE("cobradoTotal", 0)
      ORDER BY COALESCE("fechaVencimientoComercial", "fechaFinalizada"::date) ASC,
               "fechaFinalizada" ASC,
               "createdAt" ASC
      FOR UPDATE
    `);
    if (ids.length === 0) return [];
    const ordenes = await tx.ordenTrabajo.findMany({
      where: { tenantId, id: { in: ids.map((fila) => fila.id) } },
      select: { id: true, total: true, cobradoTotal: true },
    });
    const porId = new Map(ordenes.map((orden) => [orden.id, orden]));
    let libre = Number(cobro.montoBruto);
    const aplicaciones: Array<{ ordenId: string; monto: number }> = [];
    for (const { id: ordenId } of ids) {
      if (libre <= EPS) break;
      const orden = porId.get(ordenId);
      if (!orden) continue;
      const pendiente = r2(
        Number(orden.total ?? 0) - Number(orden.cobradoTotal ?? 0),
      );
      const monto = r2(Math.min(libre, pendiente));
      if (monto <= EPS) continue;
      await tx.cobroOrden.create({
        data: { tenantId, cobroId, ordenId, monto },
      });
      await tx.ordenTrabajo.update({
        where: { id: ordenId },
        data: { cobradoTotal: { increment: monto } },
      });
      aplicaciones.push({ ordenId, monto });
      libre = r2(libre - monto);
    }
    return aplicaciones;
  }

  /** Aplica anticipos todavía libres cuando una nueva orden queda exigible. */
  async aplicarAnticiposClienteAOrden(
    tx: Prisma.TransactionClient,
    tenantId: string,
    ordenId: string,
  ): Promise<void> {
    const bloqueada = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id"
      FROM "OrdenTrabajo"
      WHERE "id" = ${ordenId}::uuid AND "tenantId" = ${tenantId}::uuid
      FOR UPDATE
    `);
    if (bloqueada.length === 0) return;
    const orden = await tx.ordenTrabajo.findFirst({
      where: {
        id: ordenId,
        tenantId,
        estado: { in: ['finalizada', 'entregada'] },
      },
      select: { clienteId: true, total: true, cobradoTotal: true },
    });
    if (!orden?.clienteId) return;
    let pendiente = r2(
      Number(orden.total ?? 0) - Number(orden.cobradoTotal ?? 0),
    );
    if (pendiente <= EPS) return;

    const cobroIds = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id"
      FROM "Cobro"
      WHERE "tenantId" = ${tenantId}::uuid
        AND "clienteId" = ${orden.clienteId}::uuid
        AND "ordenId" IS NULL
        AND "anuladoEl" IS NULL
      ORDER BY "fecha" ASC, "createdAt" ASC
      FOR UPDATE
    `);
    for (const { id: cobroId } of cobroIds) {
      if (pendiente <= EPS) break;
      const cobro = await tx.cobro.findFirst({
        where: { id: cobroId, tenantId, anuladoEl: null },
        select: {
          montoBruto: true,
          aplicacionesOrden: { select: { monto: true } },
        },
      });
      if (!cobro) continue;
      const yaAplicado = cobro.aplicacionesOrden.reduce(
        (suma, aplicacion) => suma + Number(aplicacion.monto),
        0,
      );
      const libre = r2(Number(cobro.montoBruto) - yaAplicado);
      const monto = r2(Math.min(libre, pendiente));
      if (monto <= EPS) continue;
      await tx.cobroOrden.create({
        data: { tenantId, cobroId, ordenId, monto },
      });
      pendiente = r2(pendiente - monto);
    }
    await this.recalcularCobrado(tx, tenantId, ordenId);
  }

  /**
   * Valida el tope duro: no se puede facturar más que el total de la
   * orden. Corre ANTES de pedir el CAE (la autoridad es la emisión, no el
   * borrador: dos borradores del 100% conviven, el segundo en emitirse
   * rebota acá). Sólo aplica a facturas — una NC libera cupo, no lo usa.
   */
  async validarTope(
    tx: Prisma.TransactionClient,
    tenantId: string,
    comprobanteId: string,
  ): Promise<void> {
    const vinculos = await tx.comprobanteOrden.findMany({
      where: { tenantId, comprobanteId },
      select: {
        monto: true,
        orden: {
          select: { numero: true, total: true, facturadoTotal: true },
        },
      },
    });
    for (const v of vinculos) {
      const total = Number(v.orden.total ?? 0);
      const saldoSinFacturar = r2(total - Number(v.orden.facturadoTotal));
      if (Number(v.monto) > saldoSinFacturar + EPS) {
        throw new BadRequestException(
          `La orden ${v.orden.numero} tiene $${saldoSinFacturar.toLocaleString('es-AR')} sin facturar y esta factura le aplica $${Number(v.monto).toLocaleString('es-AR')}: no se puede facturar más que el total de la orden.`,
        );
      }
    }
  }

  /**
   * Matching al registrar un COBRO: cancela FIFO las facturas emitidas
   * impagas de su orden. En facturas multi-orden respeta la porción de la
   * orden (ver `aplicarCobroAFactura`). El remanente queda libre, a
   * cuenta de la orden.
   */
  async matchearCobro(
    tx: Prisma.TransactionClient,
    tenantId: string,
    cobroId: string,
  ): Promise<void> {
    const cobro = await tx.cobro.findFirst({
      where: { id: cobroId, tenantId, anuladoEl: null },
      include: { imputaciones: { select: { monto: true } } },
    });
    if (!cobro) return;

    let libre = r2(
      Number(cobro.montoBruto) -
        cobro.imputaciones.reduce((s, i) => s + Number(i.monto), 0),
    );
    if (libre <= EPS) return;

    if (cobro.ordenId) {
      const facturas = await this.facturasImpagasDeOrden(
        tx,
        tenantId,
        cobro.ordenId,
      );
      for (const factura of facturas) {
        if (libre <= EPS) break;
        const aplicado = await this.aplicarCobroAFactura(
          tx,
          tenantId,
          { id: cobro.id, ordenId: cobro.ordenId, libre },
          factura,
        );
        libre = r2(libre - aplicado);
      }
      return;
    }

    // Cobro general de cuenta corriente: fiscalmente aplica FIFO contra las
    // facturas del cliente, independientemente de la distribución comercial.
    if (!cobro.clienteId) return;
    const facturas = await tx.comprobante.findMany({
      where: {
        tenantId,
        clienteId: cobro.clienteId,
        tipo: 'factura',
        estado: 'emitido',
        anuladoEl: null,
        saldoPendiente: { gt: 0 },
      },
      select: { id: true },
      orderBy: [{ vencimiento: 'asc' }, { fecha: 'asc' }, { createdAt: 'asc' }],
    });
    for (const factura of facturas) {
      if (libre <= EPS) break;
      const aplicado = await this.aplicarCobroLibreAFactura(
        tx,
        tenantId,
        { id: cobro.id, libre },
        factura,
      );
      libre = r2(libre - aplicado);
    }
  }

  /**
   * Matching al EMITIR una factura: absorbe FIFO los cobros libres de
   * cada orden vinculada, hasta la porción de esa orden en la factura.
   * (La realidad va en los dos sentidos: a veces la factura llega antes
   * que el pago, a veces después — por eso el matching corre en ambos
   * gatillos.)
   */
  async matchearFactura(
    tx: Prisma.TransactionClient,
    tenantId: string,
    comprobanteId: string,
  ): Promise<void> {
    const comprobante = await tx.comprobante.findFirst({
      where: { id: comprobanteId, tenantId },
      select: {
        tipo: true,
        estado: true,
        clienteId: true,
        saldoPendiente: true,
        ordenes: { select: { ordenId: true, monto: true } },
      },
    });
    if (
      !comprobante ||
      comprobante.tipo !== 'factura' ||
      comprobante.estado !== 'emitido'
    ) {
      return;
    }

    for (const vinculo of comprobante.ordenes) {
      const cobros = await tx.cobro.findMany({
        where: { tenantId, ordenId: vinculo.ordenId, anuladoEl: null },
        include: { imputaciones: { select: { monto: true } } },
        orderBy: [{ fecha: 'asc' }, { createdAt: 'asc' }],
      });
      for (const cobro of cobros) {
        const libre = r2(
          Number(cobro.montoBruto) -
            cobro.imputaciones.reduce((s, i) => s + Number(i.monto), 0),
        );
        if (libre <= EPS) continue;
        const factura = await tx.comprobante.findUniqueOrThrow({
          where: { id: comprobanteId },
          select: { id: true, saldoPendiente: true },
        });
        if (Number(factura.saldoPendiente) <= EPS) return;
        await this.aplicarCobroAFactura(
          tx,
          tenantId,
          { id: cobro.id, ordenId: vinculo.ordenId, libre },
          factura,
        );
      }
    }

    if (!comprobante.clienteId) return;
    const cobrosGenerales = await tx.cobro.findMany({
      where: {
        tenantId,
        clienteId: comprobante.clienteId,
        ordenId: null,
        anuladoEl: null,
      },
      include: { imputaciones: { select: { monto: true } } },
      orderBy: [{ fecha: 'asc' }, { createdAt: 'asc' }],
    });
    for (const cobro of cobrosGenerales) {
      const libre = r2(
        Number(cobro.montoBruto) -
          cobro.imputaciones.reduce((s, i) => s + Number(i.monto), 0),
      );
      if (libre <= EPS) continue;
      const factura = await tx.comprobante.findUniqueOrThrow({
        where: { id: comprobanteId },
        select: { id: true, saldoPendiente: true },
      });
      if (Number(factura.saldoPendiente) <= EPS) return;
      await this.aplicarCobroLibreAFactura(
        tx,
        tenantId,
        { id: cobro.id, libre },
        factura,
      );
    }
  }

  /**
   * Reversa al anular un cobro: borra sus imputaciones (restaurando el
   * saldo fiscal de cada factura) y recalcula el cobradoTotal. El caller
   * ya marcó `anuladoEl`.
   */
  async revertirCobro(
    tx: Prisma.TransactionClient,
    tenantId: string,
    cobroId: string,
  ): Promise<void> {
    const cobro = await tx.cobro.findFirst({
      where: { id: cobroId, tenantId },
      include: {
        imputaciones: true,
        aplicacionesOrden: { select: { ordenId: true } },
      },
    });
    if (!cobro) return;
    for (const imp of cobro.imputaciones) {
      await tx.comprobante.update({
        where: { id: imp.comprobanteId },
        data: { saldoPendiente: { increment: Number(imp.monto) } },
      });
    }
    await tx.cobroImputacion.deleteMany({
      where: { cobroId, tenantId },
    });
    const ordenes = new Set(cobro.aplicacionesOrden.map((a) => a.ordenId));
    if (cobro.ordenId) ordenes.add(cobro.ordenId);
    for (const ordenId of ordenes) {
      await this.recalcularCobrado(tx, tenantId, ordenId);
    }
  }

  /**
   * Reversa al anular una factura (vía NC o anulación interna): borra sus
   * imputaciones (los cobros quedan libres), recalcula el facturado de
   * sus órdenes y RE-MATCHEA los cobros liberados contra otras facturas
   * impagas de la misma orden.
   */
  async revertirFactura(
    tx: Prisma.TransactionClient,
    tenantId: string,
    comprobanteId: string,
  ): Promise<void> {
    const imputaciones = await tx.cobroImputacion.findMany({
      where: { comprobanteId, tenantId },
      select: { cobroId: true },
    });
    await tx.cobroImputacion.deleteMany({ where: { comprobanteId, tenantId } });

    // El saldo de la factura se REHACE, no se devuelve sumando lo que tenía
    // imputado: lo que queda por cobrar es su total menos lo que las notas de
    // crédito ya le sacaron. Con una NC total el saldo queda en 0 y los cobros
    // liberados no vuelven a pegarse a ella —si no, el matching desharía la
    // NC—; con una NC parcial queda el resto, y el cobro se re-imputa hasta ahí.
    const factura = await tx.comprobante.findFirst({
      where: { id: comprobanteId, tenantId },
      select: { total: true },
    });
    if (factura) {
      const notas = await tx.comprobante.aggregate({
        where: {
          tenantId,
          comprobanteOrigenId: comprobanteId,
          tipo: 'nota_credito',
          estado: 'emitido',
          anuladoEl: null,
        },
        _sum: { total: true },
      });
      const saldo = Math.max(
        0,
        r2(Number(factura.total) - Number(notas._sum.total ?? 0)),
      );
      await tx.comprobante.update({
        where: { id: comprobanteId },
        data: { saldoPendiente: saldo },
      });
    }

    const vinculos = await tx.comprobanteOrden.findMany({
      where: { comprobanteId, tenantId },
      select: { ordenId: true },
    });
    for (const v of vinculos) {
      await this.recalcularFacturado(tx, tenantId, v.ordenId);
    }
    // Los cobros liberados buscan otra factura impaga de su orden.
    for (const imp of imputaciones) {
      await this.matchearCobro(tx, tenantId, imp.cobroId);
    }
  }

  /** Post-emisión (fuera del circuito ARCA): denormalizados + matching. */
  async alEmitirComprobante(tenantId: string, comprobanteId: string) {
    await this.prisma.$transaction(async (tx) => {
      const emitido = await tx.comprobante.findFirst({
        where: { id: comprobanteId, tenantId },
        select: { tipo: true, comprobanteOrigenId: true },
      });

      const vinculos = await tx.comprobanteOrden.findMany({
        where: { comprobanteId, tenantId },
        select: { ordenId: true },
      });
      for (const v of vinculos) {
        await this.recalcularFacturado(tx, tenantId, v.ordenId);
      }

      // Una NC no cobra nada: DESHACE. Hasta acá emitirla sólo restaba del
      // facturado y dejaba la factura corregida con su saldo y sus cobros
      // imputados como si nada hubiera pasado — o sea, plata pegada a un
      // comprobante que ya no debería estar vivo.
      if (emitido?.tipo === 'nota_credito' && emitido.comprobanteOrigenId) {
        await this.revertirFactura(tx, tenantId, emitido.comprobanteOrigenId);
        return;
      }

      await this.matchearFactura(tx, tenantId, comprobanteId);
    });
  }

  /**
   * La vista Administración → Facturación: órdenes finalizadas/entregadas
   * con saldo sin facturar. El filtro total>facturado se hace acá (Prisma
   * no compara columnas entre sí); el volumen de finalizadas vivas lo
   * aguanta de sobra.
   */
  async pendientesFacturacion(tenantId: string) {
    const ordenes = await this.prisma.ordenTrabajo.findMany({
      where: {
        tenantId,
        estado: { in: ['finalizada', 'entregada'] },
        total: { gt: 0 },
        // Las órdenes sin comprobante fiscal quedan FUERA de la cola: no se
        // facturan por error. Ver docs/margen-y-decisiones-de-precio.md §6.
        tratamientoFiscal: 'FISCAL',
      },
      select: {
        id: true,
        numero: true,
        estado: true,
        clienteId: true,
        cliente: { select: { nombre: true, condicionFiscal: true } },
        fechaFinalizada: true,
        total: true,
        facturadoTotal: true,
        cobradoTotal: true,
      },
      orderBy: { fechaFinalizada: 'asc' },
      take: 500,
    });
    return ordenes
      .filter((o) => Number(o.total ?? 0) - Number(o.facturadoTotal) > 0.01)
      .map((o) => ({
        ordenId: o.id,
        numero: o.numero,
        estado: o.estado,
        clienteId: o.clienteId,
        clienteNombre: o.cliente?.nombre ?? null,
        clienteCondicionFiscal: o.cliente?.condicionFiscal ?? null,
        fechaFinalizada: o.fechaFinalizada
          ? o.fechaFinalizada.toISOString().slice(0, 10)
          : null,
        total: Number(o.total ?? 0),
        facturado: Number(o.facturadoTotal),
        cobrado: Number(o.cobradoTotal),
        saldoSinFacturar: r2(Number(o.total ?? 0) - Number(o.facturadoTotal)),
      }));
  }

  // ── Primitivas privadas ────────────────────────────────────────────

  /** Facturas emitidas con saldo de una orden, de la más vieja a la más nueva. */
  private async facturasImpagasDeOrden(
    tx: Prisma.TransactionClient,
    tenantId: string,
    ordenId: string,
  ) {
    const vinculos = await tx.comprobanteOrden.findMany({
      where: {
        tenantId,
        ordenId,
        comprobante: {
          tipo: 'factura',
          estado: 'emitido',
          anuladoEl: null,
          saldoPendiente: { gt: 0 },
        },
      },
      select: {
        comprobante: { select: { id: true, fecha: true, createdAt: true } },
      },
    });
    return vinculos
      .map((v) => v.comprobante)
      .sort(
        (a, b) =>
          a.fecha.getTime() - b.fecha.getTime() ||
          a.createdAt.getTime() - b.createdAt.getTime(),
      )
      .map((c) => ({ id: c.id }));
  }

  /**
   * Aplica lo que puede de un cobro a una factura y devuelve el monto
   * aplicado. Tres topes: lo libre del cobro, el saldo de la factura, y
   * la porción de la ORDEN del cobro en esa factura (en una factura de
   * varias órdenes, los cobros de la orden A no cancelan la parte de B).
   * Suma sobre imputaciones existentes si el par cobro-factura ya existe.
   */
  private async aplicarCobroAFactura(
    tx: Prisma.TransactionClient,
    tenantId: string,
    cobro: { id: string; ordenId: string; libre: number },
    factura: { id: string },
  ): Promise<number> {
    const [vinculo, actual] = await Promise.all([
      tx.comprobanteOrden.findUnique({
        where: {
          comprobanteId_ordenId: {
            comprobanteId: factura.id,
            ordenId: cobro.ordenId,
          },
        },
        select: { monto: true },
      }),
      tx.comprobante.findUniqueOrThrow({
        where: { id: factura.id },
        select: { saldoPendiente: true },
      }),
    ]);
    if (!vinculo) return 0;

    // Cuánto de la porción de esta orden ya está cancelado por OTROS
    // cobros de la misma orden.
    const aplicadoDeOrden = await tx.cobroImputacion.aggregate({
      where: {
        tenantId,
        comprobanteId: factura.id,
        cobro: { ordenId: cobro.ordenId },
      },
      _sum: { monto: true },
    });
    const cupoOrden = r2(
      Number(vinculo.monto) - Number(aplicadoDeOrden._sum.monto ?? 0),
    );

    const monto = r2(
      Math.min(cobro.libre, Number(actual.saldoPendiente), cupoOrden),
    );
    if (monto <= EPS) return 0;

    const actualizado = await tx.comprobante.updateMany({
      where: { id: factura.id, tenantId, saldoPendiente: { gte: monto } },
      data: { saldoPendiente: { decrement: monto } },
    });
    if (actualizado.count !== 1) {
      throw new BadRequestException(
        'El saldo de la factura cambió mientras se aplicaba el cobro. Reintentá la operación.',
      );
    }

    // El par (cobro, factura) es único: si ya existe (p. ej. un re-match
    // tras liberar cupo), se acumula sobre la imputación existente.
    await tx.cobroImputacion.upsert({
      where: {
        cobroId_comprobanteId: {
          cobroId: cobro.id,
          comprobanteId: factura.id,
        },
      },
      create: {
        tenantId,
        cobroId: cobro.id,
        comprobanteId: factura.id,
        monto,
      },
      update: { monto: { increment: monto } },
    });
    return monto;
  }

  /** Aplicación fiscal de un cobro general del cliente, sin OT exclusiva. */
  private async aplicarCobroLibreAFactura(
    tx: Prisma.TransactionClient,
    tenantId: string,
    cobro: { id: string; libre: number },
    factura: { id: string },
  ): Promise<number> {
    const actual = await tx.comprobante.findFirst({
      where: {
        id: factura.id,
        tenantId,
        tipo: 'factura',
        estado: 'emitido',
        anuladoEl: null,
      },
      select: { saldoPendiente: true },
    });
    if (!actual) return 0;
    const monto = r2(Math.min(cobro.libre, Number(actual.saldoPendiente)));
    if (monto <= EPS) return 0;

    const actualizado = await tx.comprobante.updateMany({
      where: { id: factura.id, tenantId, saldoPendiente: { gte: monto } },
      data: { saldoPendiente: { decrement: monto } },
    });
    if (actualizado.count !== 1) {
      throw new BadRequestException(
        'El saldo de la factura cambió mientras se aplicaba el cobro. Reintentá la operación.',
      );
    }
    await tx.cobroImputacion.upsert({
      where: {
        cobroId_comprobanteId: {
          cobroId: cobro.id,
          comprobanteId: factura.id,
        },
      },
      create: {
        tenantId,
        cobroId: cobro.id,
        comprobanteId: factura.id,
        monto,
      },
      update: { monto: { increment: monto } },
    });
    return monto;
  }
}
