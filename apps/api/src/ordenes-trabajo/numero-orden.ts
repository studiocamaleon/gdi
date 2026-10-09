import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';

// Referencia interna única, sin tocar el contador comercial. Se conserva
// numero NOT NULL para compatibilidad con órdenes e integraciones históricas.
export const referenciaBorrador = () => `BORRADOR-${randomUUID()}`;
export const esReferenciaBorrador = (numero: string) =>
  numero.startsWith('BORRADOR-');
export const numeroOrdenVisible = (numero: string) =>
  esReferenciaBorrador(numero) ? 'Borrador' : numero;

/** Siempre dentro de la transacción que emite: un fallo revierte el contador. */
export async function asignarNumeroOrden(
  tx: Prisma.TransactionClient,
  tenantId: string,
  ordenId: string,
  fecha: Date,
) {
  const anio = fecha.getFullYear();
  const contador = await tx.ordenTrabajoContador.upsert({
    where: { tenantId_anio: { tenantId, anio } },
    create: { tenantId, anio, ultimo: 1 },
    update: { ultimo: { increment: 1 } },
  });
  const numero = `OT-${anio}-${String(contador.ultimo).padStart(4, '0')}`;
  await tx.ordenTrabajo.update({ where: { id: ordenId }, data: { numero } });
  return numero;
}
