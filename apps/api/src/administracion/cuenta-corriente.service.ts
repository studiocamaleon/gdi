import { Injectable, NotFoundException } from '@nestjs/common';
import { CurrentAuth } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import {
  calcularAging,
  totalAging,
  vencidoGrave,
  type ComprobanteAging,
} from './aging';

const r2 = (n: number) => Math.round(n * 100) / 100;
const iso = (d: Date) => d.toISOString().slice(0, 10);

/** La deuda comercial de una orden: lo vendido menos lo cobrado, piso 0. */
const deudaDe = (o: { total: unknown; cobradoTotal: unknown }) =>
  Math.max(0, r2(Number(o.total ?? 0) - Number(o.cobradoTotal ?? 0)));

/**
 * Cuenta corriente de un cliente: el ledger cronológico con saldo corrido.
 *
 * La deuda acá es COMERCIAL: nace de la ORDEN al finalizar (lo vendido),
 * no de la factura. Lo fiscal (qué parte está facturada) es información
 * secundaria del renglón. Ver docs/facturacion-ordenes-deuda-comercial-diseno.md §6.4.
 *
 * Convención contable de la vista: DEBE es lo que el cliente pasa a
 * deber (órdenes finalizadas, por su total) y HABER lo que lo cancela
 * (cobros). El saldo corrido se calcula del movimiento más viejo al más
 * nuevo y se presenta al revés, como en el diseño. Saldo positivo =
 * el cliente debe.
 *
 * Un cobro entra al ledger por su BRUTO: es lo que el cliente entregó. La
 * comisión del método es un costo nuestro y vive en tesorería, no en la
 * deuda del cliente.
 */
@Injectable()
export class CuentaCorrienteService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Matriz de deudores: un cliente por fila con su saldo repartido en los
   * tramos de antigüedad.
   *
   * Sólo entran órdenes FINALIZADAS o ENTREGADAS con saldo sin cobrar:
   * una orden en producción no es deuda todavía (aunque tenga seña) y una
   * cobrada tampoco. El aging corre desde la FINALIZACIÓN (sin plazos por
   * ahora, todo lo finalizado ya es exigible: el tramo "a vencer" queda
   * vacío). Las órdenes de mostrador sin cliente se agrupan en una fila
   * propia. Un cliente que quedó en cero no aparece — la matriz es de
   * deudores, no de clientes.
   */
  async deudores(auth: CurrentAuth) {
    const ordenes = await this.prisma.ordenTrabajo.findMany({
      where: {
        tenantId: auth.tenantId,
        estado: { in: ['finalizada', 'entregada'] },
        total: { gt: 0 },
      },
      select: {
        clienteId: true,
        fechaFinalizada: true,
        fechaVencimientoComercial: true,
        total: true,
        cobradoTotal: true,
        facturadoTotal: true,
        cliente: { select: { nombre: true, cuit: true } },
      },
    });

    const hoy = new Date();
    const porCliente = new Map<
      string,
      {
        clienteId: string | null;
        nombre: string;
        cuit: string | null;
        comps: ComprobanteAging[];
        total: number;
        facturado: number;
      }
    >();

    for (const o of ordenes) {
      const deuda = deudaDe(o);
      if (deuda <= 0) continue;
      const clave = o.clienteId ?? 'mostrador';
      const acc = porCliente.get(clave) ?? {
        clienteId: o.clienteId,
        nombre: o.clienteId
          ? (o.cliente?.nombre ?? 'Sin nombre')
          : 'Mostrador / sin cliente',
        cuit: o.clienteId ? (o.cliente?.cuit ?? null) : null,
        comps: [],
        total: 0,
        facturado: 0,
      };
      // El aging reusa la mecánica de vencimientos con la fecha de
      // finalización como vencimiento: los días "vencidos" son días
      // desde que la orden está lista.
      acc.comps.push({
        vencimiento: o.fechaVencimientoComercial ?? o.fechaFinalizada,
        saldo: deuda,
      });
      acc.total += Number(o.total ?? 0);
      acc.facturado += Number(o.facturadoTotal ?? 0);
      porCliente.set(clave, acc);
    }

    const filas = [...porCliente.values()].map((v) => {
      const aging = calcularAging(v.comps, hoy);
      return {
        clienteId: v.clienteId,
        nombre: v.nombre,
        cuit: v.cuit,
        aging,
        total: totalAging(aging),
        /** Vencido hace más de 60 días: el criterio de riesgo del diseño. */
        vencido: vencidoGrave(aging),
        /** Eje fiscal, secundario: qué parte de lo vendido pasó por factura. */
        facturadoPct:
          v.total > 0 ? Math.round((v.facturado / v.total) * 100) : 0,
      };
    });

    filas.sort((a, b) => b.total - a.total);
    return filas;
  }

  async obtener(auth: CurrentAuth, clienteId: string) {
    const cliente = await this.prisma.cliente.findFirst({
      where: { id: clienteId, tenantId: auth.tenantId },
      select: {
        id: true,
        nombre: true,
        razonSocial: true,
        cuit: true,
        condicionFiscal: true,
        limiteCredito: true,
        plazoCuentaCorrienteDias: true,
      },
    });
    if (!cliente) {
      throw new NotFoundException(`No existe el cliente ${clienteId}`);
    }

    const [ordenes, cobros, ultimaOrden] = await Promise.all([
      this.prisma.ordenTrabajo.findMany({
        where: {
          tenantId: auth.tenantId,
          clienteId,
          estado: { in: ['finalizada', 'entregada'] },
          total: { gt: 0 },
        },
        select: {
          id: true,
          numero: true,
          fechaFinalizada: true,
          fechaVencimientoComercial: true,
          total: true,
          cobradoTotal: true,
          facturadoTotal: true,
        },
      }),
      this.prisma.cobro.findMany({
        where: { tenantId: auth.tenantId, clienteId, anuladoEl: null },
        include: {
          metodoPago: { select: { nombre: true } },
          orden: { select: { numero: true } },
          imputaciones: {
            include: {
              comprobante: {
                include: { puntoVenta: { select: { numero: true } } },
              },
            },
          },
          aplicacionesOrden: {
            include: { orden: { select: { numero: true } } },
            orderBy: { createdAt: 'asc' },
          },
        },
      }),
      // El vendedor no vive en el cliente: se deriva de su última orden.
      this.prisma.ordenTrabajo.findFirst({
        where: { tenantId: auth.tenantId, clienteId },
        orderBy: { createdAt: 'desc' },
        select: { vendedor: { select: { nombreCompleto: true } } },
      }),
    ]);

    const nombreComp = (c: {
      letra: string;
      numero: number | null;
      puntoVenta: { numero: number };
      tipo: string;
    }) => {
      const pv = String(c.puntoVenta.numero).padStart(4, '0');
      const nro = c.numero ? String(c.numero).padStart(8, '0') : '—';
      const sigla =
        c.tipo === 'factura' ? 'FA' : c.tipo === 'nota_credito' ? 'NC' : 'ND';
      return `${sigla} ${c.letra} ${pv}-${nro}`;
    };

    type Mov = {
      id: string;
      fecha: string;
      /** Para ordenar sin depender del string. */
      orden: number;
      tipo: string;
      sigla: string;
      descripcion: string;
      debe: number;
      haber: number;
      ordenId?: string;
      cobroId?: string;
      /** Eje fiscal del renglón de orden: cuánto pasó por factura. */
      facturado?: number;
      facturadoPct?: number;
      imputaciones?: Array<{ nombre: string; monto: number; resto?: boolean }>;
      aplicaciones?: Array<{ nombre: string; monto: number }>;
    };

    const movs: Mov[] = [];

    for (const o of ordenes) {
      // La orden entra al DEBE por su total cuando finaliza: ahí nace la
      // deuda. Qué parte está facturada es el dato fiscal del renglón.
      const fecha = o.fechaFinalizada ?? new Date();
      const total = Number(o.total ?? 0);
      const facturado = Number(o.facturadoTotal ?? 0);
      movs.push({
        id: o.id,
        fecha: iso(fecha),
        orden: fecha.getTime(),
        tipo: 'orden',
        sigla: 'OT',
        descripcion: `Orden ${o.numero}`,
        debe: total,
        haber: 0,
        ordenId: o.id,
        facturado,
        facturadoPct: total > 0 ? Math.round((facturado / total) * 100) : 0,
      });
    }

    for (const co of cobros) {
      const bruto = Number(co.montoBruto);
      const imputado = co.imputaciones.reduce((s, i) => s + Number(i.monto), 0);
      const sinImputar = r2(bruto - imputado);
      const imputaciones = co.imputaciones.map((i) => ({
        nombre: nombreComp(i.comprobante),
        monto: Number(i.monto),
      }));
      const aplicaciones = co.aplicacionesOrden.map((a) => ({
        nombre: a.orden.numero,
        monto: Number(a.monto),
      }));
      if (sinImputar > 0 && imputaciones.length > 0) {
        // Lo que no se aplicó a ninguna factura (sólo informativo: la
        // deuda comercial no depende de la imputación fiscal).
        imputaciones.push({
          nombre: 'Sin aplicar a factura',
          monto: sinImputar,
          resto: true,
        } as { nombre: string; monto: number; resto?: boolean });
      }
      movs.push({
        id: co.id,
        fecha: iso(co.fecha),
        orden: co.fecha.getTime(),
        tipo: 'cobro',
        sigla: 'COB',
        descripcion: co.orden
          ? `Cobro ${co.metodoPago.nombre} — ${co.orden.numero}`
          : `Cobro ${co.metodoPago.nombre}`,
        debe: 0,
        haber: bruto,
        cobroId: co.id,
        imputaciones,
        aplicaciones,
      });
    }

    // Saldo corrido del más viejo al más nuevo…
    movs.sort((a, b) => a.orden - b.orden);
    let acumulado = 0;
    const conSaldo = movs.map((m) => {
      acumulado = r2(acumulado + m.debe - m.haber);
      return { ...m, saldo: acumulado };
    });
    // …y se presenta al revés, como el diseño.
    conSaldo.reverse();

    const saldo = acumulado;
    // El aging corre por orden con saldo, desde su finalización.
    const paraAging: ComprobanteAging[] = ordenes
      .map((o) => ({
        vencimiento: o.fechaVencimientoComercial ?? o.fechaFinalizada,
        saldo: deudaDe(o),
      }))
      .filter((c) => c.saldo > 0);
    const aging = calcularAging(paraAging, new Date());
    const pendientes = paraAging.length;
    const limite =
      cliente.limiteCredito === null ? null : Number(cliente.limiteCredito);

    const vendedor = ultimaOrden?.vendedor?.nombreCompleto ?? null;

    return {
      cliente: {
        id: cliente.id,
        nombre: cliente.nombre,
        razonSocial: cliente.razonSocial,
        cuit: cliente.cuit,
        condicionFiscal: cliente.condicionFiscal,
        limiteCredito: limite,
        plazoCuentaCorrienteDias: cliente.plazoCuentaCorrienteDias,
        vendedor,
      },
      saldo,
      /** Órdenes con saldo sin cobrar (antes: comprobantes pendientes). */
      comprobantesPendientes: pendientes,
      /** null cuando no se definió límite: la barra no se muestra. */
      usoLimitePct:
        limite && limite > 0 ? Math.round((saldo / limite) * 100) : null,
      excedido: limite !== null && saldo > limite,
      excedente: limite !== null && saldo > limite ? r2(saldo - limite) : 0,
      aging,
      agingTotal: totalAging(aging),
      movimientos: conSaldo,
    };
  }
}
