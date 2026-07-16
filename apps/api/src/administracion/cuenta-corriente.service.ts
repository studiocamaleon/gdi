import { Injectable, NotFoundException } from '@nestjs/common';
import { CurrentAuth } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { calcularAging, totalAging, type ComprobanteAging } from './aging';

const r2 = (n: number) => Math.round(n * 100) / 100;
const iso = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Cuenta corriente de un cliente: el ledger cronológico con saldo corrido.
 *
 * Convención contable de la vista: DEBE es lo que el cliente pasa a
 * deber (facturas, notas de débito) y HABER lo que lo cancela (cobros,
 * notas de crédito). El saldo corrido se calcula del movimiento más viejo
 * al más nuevo y se presenta al revés, como en el diseño. Saldo positivo =
 * el cliente debe.
 *
 * Un cobro entra al ledger por su BRUTO: es lo que el cliente entregó. La
 * comisión del método es un costo nuestro y vive en tesorería, no en la
 * deuda del cliente.
 */
@Injectable()
export class CuentaCorrienteService {
  constructor(private readonly prisma: PrismaService) {}

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
      },
    });
    if (!cliente) {
      throw new NotFoundException(`No existe el cliente ${clienteId}`);
    }

    const [comprobantes, cobros, ultimaOrden] = await Promise.all([
      this.prisma.comprobante.findMany({
        where: {
          tenantId: auth.tenantId,
          clienteId,
          estado: 'emitido',
        },
        include: { puntoVenta: { select: { numero: true } } },
      }),
      this.prisma.cobro.findMany({
        where: { tenantId: auth.tenantId, clienteId, anuladoEl: null },
        include: {
          metodoPago: { select: { nombre: true } },
          imputaciones: {
            include: {
              comprobante: {
                include: { puntoVenta: { select: { numero: true } } },
              },
            },
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
      comprobanteId?: string;
      cobroId?: string;
      imputaciones?: Array<{ nombre: string; monto: number; resto?: boolean }>;
    };

    const movs: Mov[] = [];

    for (const c of comprobantes) {
      // Una NC descuenta deuda: va al haber.
      const esCredito = c.tipo === 'nota_credito';
      const monto = Math.abs(Number(c.total));
      movs.push({
        id: c.id,
        fecha: iso(c.fecha),
        orden: c.fecha.getTime(),
        tipo: esCredito ? 'nc' : c.tipo === 'nota_debito' ? 'nd' : 'fa',
        sigla: esCredito ? 'NC' : c.tipo === 'nota_debito' ? 'ND' : 'FA',
        descripcion: nombreComp(c),
        debe: esCredito ? 0 : monto,
        haber: esCredito ? monto : 0,
        comprobanteId: c.id,
      });
    }

    for (const co of cobros) {
      const bruto = Number(co.montoBruto);
      const imputado = co.imputaciones.reduce(
        (s, i) => s + Number(i.monto),
        0,
      );
      const sinImputar = r2(bruto - imputado);
      const imputaciones = co.imputaciones.map((i) => ({
        nombre: nombreComp(i.comprobante),
        monto: Number(i.monto),
      }));
      if (sinImputar > 0) {
        // Lo que no se aplicó a ninguna factura queda como anticipo.
        imputaciones.push({
          nombre: 'Anticipo sin imputar',
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
        descripcion: `Cobro ${co.metodoPago.nombre}`,
        debe: 0,
        haber: bruto,
        cobroId: co.id,
        imputaciones,
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
    const paraAging: ComprobanteAging[] = comprobantes.map((c) => ({
      vencimiento: c.vencimiento,
      saldo: Number(c.saldoPendiente),
    }));
    const aging = calcularAging(paraAging, new Date());
    const pendientes = comprobantes.filter(
      (c) => Number(c.saldoPendiente) > 0,
    ).length;
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
        vendedor,
      },
      saldo,
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
