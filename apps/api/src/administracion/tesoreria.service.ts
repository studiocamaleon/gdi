import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { CurrentAuth } from '../auth/auth.types';
import type {
  ArqueoDto,
  TransferenciaDto,
  UpsertCuentaFondosDto,
} from './dto/tesoreria.dto';

@Injectable()
export class TesoreriaService {
  constructor(private readonly prisma: PrismaService) {}

  /** Cuentas + KPIs de posición (por moneda, efectivo, bancos, a acreditar). */
  async resumen(auth: CurrentAuth) {
    const [cuentas, pendientes] = await Promise.all([
      this.prisma.cuentaFondos.findMany({
        where: { tenantId: auth.tenantId, activo: true },
        orderBy: [{ tipo: 'asc' }, { nombre: 'asc' }],
        include: {
          movimientos: {
            orderBy: { fecha: 'desc' },
            take: 1,
            select: { fecha: true },
          },
        },
      }),
      this.prisma.cobro.aggregate({
        where: {
          tenantId: auth.tenantId,
          anuladoEl: null,
          estadoAcreditacion: 'pendiente',
        },
        _sum: { netoAcreditado: true },
      }),
    ]);

    const lista = cuentas.map((cuenta) => ({
      id: cuenta.id,
      tipo: cuenta.tipo,
      nombre: cuenta.nombre,
      banco: cuenta.banco,
      cbuAlias: cuenta.cbuAlias,
      moneda: cuenta.moneda,
      saldo: Number(cuenta.saldo),
      ultimoMovimiento: cuenta.movimientos[0]?.fecha.toISOString() ?? null,
      activo: cuenta.activo,
    }));

    const ars = lista.filter((c) => c.moneda === 'ARS');
    return {
      cuentas: lista,
      kpis: {
        posicionArs: ars.reduce((s, c) => s + c.saldo, 0),
        posicionUsd: lista
          .filter((c) => c.moneda === 'USD')
          .reduce((s, c) => s + c.saldo, 0),
        efectivo: ars
          .filter((c) => c.tipo === 'caja')
          .reduce((s, c) => s + c.saldo, 0),
        bancos: ars
          .filter((c) => c.tipo !== 'caja')
          .reduce((s, c) => s + c.saldo, 0),
        cajasActivas: ars.filter((c) => c.tipo === 'caja').length,
        cuentasArs: ars.filter((c) => c.tipo !== 'caja').length,
        aAcreditar: Number(pendientes._sum.netoAcreditado ?? 0),
      },
    };
  }

  async crearCuenta(auth: CurrentAuth, payload: UpsertCuentaFondosDto) {
    const cuenta = await this.prisma.cuentaFondos.create({
      data: {
        tenantId: auth.tenantId,
        tipo: payload.tipo,
        nombre: payload.nombre,
        banco: payload.banco ?? null,
        cbuAlias: payload.cbuAlias ?? null,
        moneda: payload.moneda ?? 'ARS',
      },
    });
    return { id: cuenta.id };
  }

  async movimientos(auth: CurrentAuth, cuentaId: string) {
    const cuenta = await this.prisma.cuentaFondos.findFirst({
      where: { id: cuentaId, tenantId: auth.tenantId },
    });
    if (!cuenta) throw new NotFoundException('No se encontró la cuenta.');
    const movimientos = await this.prisma.movimientoFondos.findMany({
      where: { tenantId: auth.tenantId, cuentaId },
      orderBy: [{ fecha: 'desc' }, { createdAt: 'desc' }],
      take: 100,
      include: {
        orden: { select: { id: true, numero: true } },
      },
    });
    return movimientos.map((m) => ({
      id: m.id,
      fecha: m.fecha.toISOString(),
      tipo: m.tipo,
      monto: Number(m.monto),
      concepto: m.concepto,
      origenTipo: m.origenTipo,
      ordenId: m.orden?.id ?? null,
      ordenNumero: m.orden?.numero ?? null,
      saldoPosterior: Number(m.saldoPosterior),
    }));
  }

  /** Par de movimientos espejo entre cuentas propias. */
  async transferir(auth: CurrentAuth, payload: TransferenciaDto) {
    if (payload.desdeCuentaId === payload.haciaCuentaId) {
      throw new BadRequestException('Elegí dos cuentas distintas.');
    }
    const [desde, hacia] = await Promise.all([
      this.prisma.cuentaFondos.findFirst({
        where: { id: payload.desdeCuentaId, tenantId: auth.tenantId },
      }),
      this.prisma.cuentaFondos.findFirst({
        where: { id: payload.haciaCuentaId, tenantId: auth.tenantId },
      }),
    ]);
    if (!desde || !hacia) {
      throw new NotFoundException('No se encontró alguna de las cuentas.');
    }

    await this.prisma.$transaction(async (tx) => {
      const ahora = new Date();
      const desdeAct = await tx.cuentaFondos.update({
        where: { id: desde.id },
        data: { saldo: { decrement: payload.monto } },
      });
      const salida = await tx.movimientoFondos.create({
        data: {
          tenantId: auth.tenantId,
          cuentaId: desde.id,
          fecha: ahora,
          tipo: 'salida',
          monto: payload.monto,
          concepto: `Transferencia a ${hacia.nombre}`,
          origenTipo: 'transferencia',
          saldoPosterior: Number(desdeAct.saldo),
        },
      });
      const haciaAct = await tx.cuentaFondos.update({
        where: { id: hacia.id },
        data: { saldo: { increment: payload.monto } },
      });
      await tx.movimientoFondos.create({
        data: {
          tenantId: auth.tenantId,
          cuentaId: hacia.id,
          fecha: ahora,
          tipo: 'entrada',
          monto: payload.monto,
          concepto: `Transferencia desde ${desde.nombre}`,
          origenTipo: 'transferencia',
          transferenciaParId: salida.id,
          saldoPosterior: Number(haciaAct.saldo),
        },
      });
    });
    return { ok: true };
  }

  /** Arqueo de caja: ajusta el saldo del sistema a lo contado. */
  async arqueo(auth: CurrentAuth, cuentaId: string, payload: ArqueoDto) {
    const cuenta = await this.prisma.cuentaFondos.findFirst({
      where: { id: cuentaId, tenantId: auth.tenantId },
    });
    if (!cuenta) throw new NotFoundException('No se encontró la cuenta.');
    if (cuenta.tipo !== 'caja') {
      throw new BadRequestException('El arqueo aplica sólo a cajas.');
    }
    const diferencia = payload.contado - Number(cuenta.saldo);
    if (diferencia === 0) return { diferencia: 0 };

    await this.prisma.$transaction(async (tx) => {
      const actualizada = await tx.cuentaFondos.update({
        where: { id: cuenta.id },
        data: { saldo: payload.contado },
      });
      await tx.movimientoFondos.create({
        data: {
          tenantId: auth.tenantId,
          cuentaId: cuenta.id,
          fecha: new Date(),
          tipo: diferencia > 0 ? 'entrada' : 'salida',
          monto: Math.abs(diferencia),
          concepto: `Arqueo de caja · ${diferencia > 0 ? 'sobrante' : 'faltante'}`,
          origenTipo: 'ajuste_arqueo',
          saldoPosterior: Number(actualizada.saldo),
        },
      });
    });
    return { diferencia };
  }
}
