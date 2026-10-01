import { ForbiddenException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { CurrentAuth } from '../auth/auth.types';

type Db = Pick<Prisma.TransactionClient, 'membership' | 'cuentaFondos'>;
export type AlcanceCuentas = {
  restringido: boolean;
  operables: string[];
  destinos: string[];
};

/** Se lee por operación, sin cachear asignaciones en la sesión. */
export async function alcanceCuentas(
  db: Db,
  auth: CurrentAuth,
): Promise<AlcanceCuentas> {
  if (auth.impersonacion)
    return { restringido: false, operables: [], destinos: [] };
  const miembro = await db.membership.findFirst({
    where: { userId: auth.userId, tenantId: auth.tenantId, activa: true },
    select: {
      cuentasRestringidas: true,
      cuentasOperablesIds: true,
      cuentasDestinoIds: true,
    },
  });
  if (!miembro)
    throw new ForbiddenException('Tu acceso a esta empresa ya no está activo.');
  return {
    restringido: miembro.cuentasRestringidas,
    operables: miembro.cuentasOperablesIds,
    destinos: miembro.cuentasDestinoIds,
  };
}
export function filtroCuentas(a: AlcanceCuentas) {
  return a.restringido ? { id: { in: a.operables } } : {};
}
export function exigirCuenta(a: AlcanceCuentas, id: string, destino = false) {
  if (a.restringido && !(destino ? a.destinos : a.operables).includes(id))
    throw new ForbiddenException(
      destino
        ? 'No tenés autorizado ese destino de transferencia.'
        : 'No tenés acceso a esa cuenta.',
    );
}
export async function exigirCuentaOperable(
  db: Db,
  auth: CurrentAuth,
  id: string,
) {
  const a = await alcanceCuentas(db, auth);
  exigirCuenta(a, id);
  return a;
}
export async function exigirTesoreriaCompleta(db: Db, auth: CurrentAuth) {
  if ((await alcanceCuentas(db, auth)).restringido)
    throw new ForbiddenException(
      'Esta acción requiere acceso completo a Tesorería.',
    );
}
export async function destinosTransferencia(db: Db, auth: CurrentAuth) {
  const a = await alcanceCuentas(db, auth);
  return db.cuentaFondos.findMany({
    where: {
      tenantId: auth.tenantId,
      activo: true,
      tipo: { in: ['caja', 'banco', 'billetera'] },
      ...(a.restringido ? { id: { in: a.destinos } } : {}),
    },
    select: { id: true, nombre: true, moneda: true },
    orderBy: { nombre: 'asc' },
  });
}
