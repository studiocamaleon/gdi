import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CurrentAuth } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { ImputarCobroDto } from './dto/comprobante.dto';
import { ejecutarTransaccionFondos } from './fondos-ledger';

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Aplica cobros a comprobantes. Reglas del negocio:
 *
 * - Un cobro sin imputaciones es un **anticipo a cuenta**: ya entró la
 *   plata pero todavía no se sabe contra qué factura va.
 * - La suma imputada nunca puede superar ni el monto del cobro ni el saldo
 *   del comprobante. Las dos validaciones corren dentro de la transacción
 *   que actualiza el saldo, para que dos imputaciones simultáneas no
 *   sobrepasen el saldo entre las dos.
 * - Se imputa el BRUTO del cobro, no el neto acreditado: la comisión del
 *   método es un costo nuestro, no algo que el cliente deje de deber.
 */
@Injectable()
export class ImputacionesService {
  constructor(private readonly prisma: PrismaService) {}

  async imputar(auth: CurrentAuth, cobroId: string, payload: ImputarCobroDto) {
    return ejecutarTransaccionFondos(this.prisma, async (tx) => {
      const cobro = await tx.cobro.findFirst({
        where: { id: cobroId, tenantId: auth.tenantId },
        include: { imputaciones: true },
      });
      if (!cobro) throw new NotFoundException(`No existe el cobro ${cobroId}`);
      if (cobro.anuladoEl) {
        throw new ConflictException('El cobro está anulado.');
      }

      const comprobante = await tx.comprobante.findFirst({
        where: { id: payload.comprobanteId, tenantId: auth.tenantId },
      });
      if (!comprobante) {
        throw new NotFoundException(
          `No existe el comprobante ${payload.comprobanteId}`,
        );
      }
      if (comprobante.estado !== 'emitido' || comprobante.anuladoEl) {
        throw new BadRequestException(
          'Sólo se puede imputar un cobro a un comprobante emitido.',
        );
      }
      if (
        comprobante.clienteId &&
        cobro.clienteId &&
        comprobante.clienteId !== cobro.clienteId
      ) {
        throw new BadRequestException(
          'El cobro y el comprobante son de clientes distintos.',
        );
      }

      const yaImputado = cobro.imputaciones.reduce(
        (s, i) => s + Number(i.monto),
        0,
      );
      const disponible = r2(Number(cobro.montoBruto) - yaImputado);
      if (payload.monto > disponible + 0.001) {
        throw new BadRequestException(
          `El cobro sólo tiene $${disponible.toLocaleString('es-AR')} sin imputar.`,
        );
      }

      const saldo = Number(comprobante.saldoPendiente);
      if (payload.monto > saldo + 0.001) {
        throw new BadRequestException(
          `El comprobante ${comprobante.letra} debe $${saldo.toLocaleString('es-AR')}: no se le puede imputar más.`,
        );
      }

      const existente = await tx.cobroImputacion.findUnique({
        where: {
          cobroId_comprobanteId: {
            cobroId,
            comprobanteId: payload.comprobanteId,
          },
        },
      });
      if (existente) {
        throw new ConflictException(
          'Ese cobro ya está imputado a ese comprobante. Quitá la imputación y volvé a crearla.',
        );
      }

      // El decremento condicional es la segunda barrera además del aislamiento
      // serializable: jamás persiste un saldo negativo aunque otro proceso
      // haya consumido la factura entre la lectura y la escritura.
      const actualizado = await tx.comprobante.updateMany({
        where: {
          id: payload.comprobanteId,
          tenantId: auth.tenantId,
          saldoPendiente: { gte: payload.monto },
        },
        data: { saldoPendiente: { decrement: payload.monto } },
      });
      if (actualizado.count !== 1) {
        throw new ConflictException(
          'El saldo del comprobante cambió mientras se aplicaba el cobro. Revisalo e intentá nuevamente.',
        );
      }

      const imputacion = await tx.cobroImputacion.create({
        data: {
          tenantId: auth.tenantId,
          cobroId,
          comprobanteId: payload.comprobanteId,
          monto: payload.monto,
        },
      });

      return {
        id: imputacion.id,
        cobroId,
        comprobanteId: payload.comprobanteId,
        monto: payload.monto,
        /** Lo que queda del cobro sin aplicar: sigue siendo anticipo. */
        cobroSinImputar: r2(disponible - payload.monto),
      };
    });
  }

  async quitar(auth: CurrentAuth, imputacionId: string) {
    return ejecutarTransaccionFondos(this.prisma, async (tx) => {
      const imp = await tx.cobroImputacion.findFirst({
        where: { id: imputacionId, tenantId: auth.tenantId },
        include: { comprobante: true },
      });
      if (!imp) {
        throw new NotFoundException(`No existe la imputación ${imputacionId}`);
      }
      await tx.cobroImputacion.delete({ where: { id: imputacionId } });
      await tx.comprobante.update({
        where: { id: imp.comprobanteId },
        data: { saldoPendiente: { increment: Number(imp.monto) } },
      });
      return { ok: true };
    });
  }

  /** Comprobantes con saldo de un cliente — el modal de imputación los lista. */
  async pendientesDeCliente(auth: CurrentAuth, clienteId: string) {
    const comprobantes = await this.prisma.comprobante.findMany({
      where: {
        tenantId: auth.tenantId,
        clienteId,
        estado: 'emitido',
        saldoPendiente: { gt: 0 },
      },
      include: { puntoVenta: { select: { numero: true } } },
      orderBy: { vencimiento: 'asc' },
    });
    const hoy = new Date();
    return comprobantes.map((c) => {
      const pv = String(c.puntoVenta.numero).padStart(4, '0');
      const nro = c.numero ? String(c.numero).padStart(8, '0') : '—';
      return {
        id: c.id,
        numeroCompleto: `${c.letra} ${pv}-${nro}`,
        tipo: c.tipo,
        fecha: c.fecha.toISOString().slice(0, 10),
        vencimiento: c.vencimiento
          ? c.vencimiento.toISOString().slice(0, 10)
          : null,
        vencida: c.vencimiento ? c.vencimiento < hoy : false,
        total: Number(c.total),
        saldo: Number(c.saldoPendiente),
      };
    });
  }
}
