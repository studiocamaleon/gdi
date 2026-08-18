import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import type { CurrentAuth } from '../auth/auth.types';
import { firmaActor } from '../common/firma-actor';
import {
  claveFechaEnZona,
  instanteDe,
  sumarDiasAClave,
  ZONA_DEFAULT,
} from '../common/zona';
import type { PrismaService } from '../prisma/prisma.service';

export const redondearFondos = (n: number) => Math.round(n * 100) / 100;

export type ActorFondos = {
  userId: string | null;
  nombre: string;
};

/**
 * Ejecuta una operación monetaria con aislamiento serializable y reintenta
 * los conflictos que PostgreSQL detecta cuando dos usuarios operan la misma
 * cuenta a la vez. El último conflicto se traduce a un mensaje accionable en
 * lugar de escapar como un error 500.
 */
export async function ejecutarTransaccionFondos<T>(
  prisma: PrismaService,
  trabajo: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let intento = 1; intento <= 3; intento += 1) {
    try {
      return await prisma.$transaction(trabajo, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      const reintentable =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034';
      if (reintentable && intento < 3) continue;
      if (reintentable) {
        throw new ConflictException(
          'La cuenta cambió mientras se procesaba la operación. Revisá el saldo e intentá nuevamente.',
        );
      }
      throw error;
    }
  }
  throw new ConflictException('No se pudo confirmar la operación monetaria.');
}

/** Congela al responsable para que la auditoría sobreviva a cambios de legajo. */
export async function resolverActorFondos(
  prisma: PrismaService,
  auth: CurrentAuth,
): Promise<ActorFondos> {
  const empleado = await prisma.empleado.findFirst({
    where: { tenantId: auth.tenantId, userId: auth.userId },
    select: { nombreCompleto: true },
  });
  return {
    userId: auth.impersonacion?.actorUserId ?? auth.userId ?? null,
    nombre: firmaActor(auth, empleado?.nombreCompleto ?? auth.email),
  };
}

/**
 * Una fecha de negocio sin hora se guarda al mediodía EN LA ZONA DEL TENANT.
 * Conserva la fecha elegida incluso fuera de América y evita el corrimiento
 * del `new Date('YYYY-MM-DD')` a la noche anterior.
 */
export function fechaNegocio(
  iso: string,
  zonaHoraria: string = ZONA_DEFAULT,
): Date {
  return instanteDe(iso.slice(0, 10), '12:00', zonaHoraria);
}

/** Suma días hábiles L-V en el calendario local del tenant. */
export function sumarDiasHabiles(
  fecha: Date,
  dias: number,
  zonaHoraria: string = ZONA_DEFAULT,
): Date {
  let clave = claveFechaEnZona(fecha, zonaHoraria);
  let restantes = Math.max(0, Math.trunc(dias));
  while (restantes > 0) {
    clave = sumarDiasAClave(clave, 1);
    const [anio, mes, dia] = clave.split('-').map(Number);
    const semana = new Date(Date.UTC(anio, mes - 1, dia)).getUTCDay();
    if (semana !== 0 && semana !== 6) restantes -= 1;
  }
  return instanteDe(clave, '12:00', zonaHoraria);
}

export type RegistrarMovimientoFondosInput = {
  tenantId: string;
  cuentaId: string;
  fecha: Date;
  tipo: 'entrada' | 'salida';
  monto: number;
  concepto: string;
  origenTipo: string;
  actor?: ActorFondos;
  cobroId?: string | null;
  pagoId?: string | null;
  valorId?: string | null;
  ordenId?: string | null;
  transferenciaParId?: string | null;
  operacionId?: string | null;
  idempotencyKey?: string | null;
  reversionDeId?: string | null;
  tipoCambio?: number | null;
  referencia?: string | null;
  notas?: string | null;
  estadoConciliacion?: 'pendiente' | 'conciliado' | 'diferencia';
};

/**
 * Única puerta de entrada al libro de fondos.
 *
 * Actualiza saldo, impide sobregiros no autorizados, crea la fila auditable y
 * recompone el saldo corrido cuando la fecha es retroactiva. Debe ejecutarse
 * dentro de la transacción de la operación de negocio que lo originó.
 */
export async function registrarMovimientoFondos(
  tx: Prisma.TransactionClient,
  input: RegistrarMovimientoFondosInput,
) {
  const monto = redondearFondos(input.monto);
  if (!Number.isFinite(monto) || monto <= 0) {
    throw new BadRequestException(
      'El movimiento debe tener un monto positivo.',
    );
  }

  const cuenta = await tx.cuentaFondos.findFirst({
    where: { id: input.cuentaId, tenantId: input.tenantId, activo: true },
    select: { id: true, saldo: true, permiteSaldoNegativo: true },
  });
  if (!cuenta) {
    throw new NotFoundException('No se encontró una cuenta activa.');
  }

  if (input.tipo === 'salida' && !cuenta.permiteSaldoNegativo) {
    const actualizada = await tx.cuentaFondos.updateMany({
      where: {
        id: cuenta.id,
        tenantId: input.tenantId,
        activo: true,
        saldo: { gte: monto },
      },
      data: { saldo: { decrement: monto } },
    });
    if (actualizada.count === 0) {
      throw new BadRequestException(
        'La cuenta no tiene saldo suficiente para realizar la operación.',
      );
    }
  } else {
    await tx.cuentaFondos.update({
      where: { id: cuenta.id },
      data: {
        saldo:
          input.tipo === 'entrada'
            ? { increment: monto }
            : { decrement: monto },
      },
    });
  }

  const cuentaActualizada = await tx.cuentaFondos.findUniqueOrThrow({
    where: { id: cuenta.id },
    select: { saldo: true },
  });
  const movimiento = await tx.movimientoFondos.create({
    data: {
      tenantId: input.tenantId,
      cuentaId: input.cuentaId,
      fecha: input.fecha,
      tipo: input.tipo,
      monto,
      concepto: input.concepto,
      origenTipo: input.origenTipo,
      cobroId: input.cobroId ?? null,
      pagoId: input.pagoId ?? null,
      valorId: input.valorId ?? null,
      ordenId: input.ordenId ?? null,
      transferenciaParId: input.transferenciaParId ?? null,
      operacionId: input.operacionId ?? null,
      idempotencyKey: input.idempotencyKey ?? null,
      reversionDeId: input.reversionDeId ?? null,
      tipoCambio: input.tipoCambio ?? null,
      referencia: input.referencia?.trim() || null,
      notas: input.notas?.trim() || null,
      actorUserId: input.actor?.userId ?? null,
      actorNombre: input.actor?.nombre ?? null,
      estadoConciliacion: input.estadoConciliacion ?? 'pendiente',
      conciliadoEl:
        input.estadoConciliacion === 'conciliado' ? new Date() : null,
      conciliadoPorId:
        input.estadoConciliacion === 'conciliado'
          ? (input.actor?.userId ?? null)
          : null,
      conciliadoPorNombre:
        input.estadoConciliacion === 'conciliado'
          ? (input.actor?.nombre ?? null)
          : null,
      saldoPosterior: Number(cuentaActualizada.saldo),
    },
  });

  await recalcularSaldoCorrido(tx, input.cuentaId, input.fecha);
  return movimiento;
}

/** Recompone el extracto desde una fecha sin alterar el saldo actual. */
export async function recalcularSaldoCorrido(
  tx: Prisma.TransactionClient,
  cuentaId: string,
  desde: Date,
) {
  const [ancla, posteriores] = await Promise.all([
    tx.movimientoFondos.findFirst({
      where: { cuentaId, fecha: { lt: desde } },
      orderBy: [{ fecha: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
      select: { saldoPosterior: true },
    }),
    tx.movimientoFondos.findMany({
      where: { cuentaId, fecha: { gte: desde } },
      orderBy: [{ fecha: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      select: { id: true, tipo: true, monto: true, saldoPosterior: true },
    }),
  ]);

  let saldo = Number(ancla?.saldoPosterior ?? 0);
  for (const movimiento of posteriores) {
    saldo = redondearFondos(
      saldo +
        (movimiento.tipo === 'entrada' ? 1 : -1) * Number(movimiento.monto),
    );
    if (Number(movimiento.saldoPosterior) === saldo) continue;
    await tx.movimientoFondos.update({
      where: { id: movimiento.id },
      data: { saldoPosterior: saldo },
    });
  }
}
