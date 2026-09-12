import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AccionPasoOrdenTrabajoDto } from './dto/accion-paso.dto';

export type AccionPasoEnGrupo = {
  ordenId: string;
  itemId: string;
  pasoId: string;
  payload: AccionPasoOrdenTrabajoDto;
  interno?: {
    tiempoLoteMin?: number;
    autoPausa?: boolean;
    accionEnCola?: { maquinaId: string };
  };
};

export function validarGrupoAcciones(acciones: AccionPasoEnGrupo[]) {
  if (!acciones.length || acciones.length > 50) {
    throw new BadRequestException('Seleccioná entre 1 y 50 operaciones.');
  }
  if (new Set(acciones.map((a) => a.pasoId)).size !== acciones.length) {
    throw new BadRequestException(
      'Un paso no puede aparecer dos veces en la misma operación conjunta.',
    );
  }
}

/** Orden de cerrojos compatible con la publicación F6. KEY SHARE permite
 * operar otras OT de la empresa en paralelo, pero espera una publicación de
 * agenda que tenga Tenant FOR UPDATE. Nunca se adquiere dentro de un bucle. */
export async function bloquearOrdenesEjecucion(
  tx: Prisma.TransactionClient,
  tenantId: string,
  acciones: AccionPasoEnGrupo[],
) {
  const ids = [...new Set(acciones.map((a) => a.ordenId))].sort();
  await tx.$queryRaw`SELECT "id" FROM "Tenant" WHERE "id" = ${tenantId}::uuid FOR KEY SHARE`;
  const ordenes = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id" FROM "OrdenTrabajo"
    WHERE "tenantId" = ${tenantId}::uuid AND "id" IN (${Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`))})
    ORDER BY "id" FOR UPDATE
  `);
  if (ordenes.length !== ids.length)
    throw new NotFoundException(
      'No se encontró una de las órdenes de producción.',
    );
  // Incluye aliases de nesting y fronteras de componentes de cada OT.
  await tx.$queryRaw(Prisma.sql`
    SELECT "id" FROM "OrdenTrabajoItemPaso"
    WHERE "tenantId" = ${tenantId}::uuid AND "ordenId" IN (${Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`))})
    ORDER BY "id" FOR UPDATE
  `);
}
