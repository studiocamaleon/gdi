import { Prisma } from '@prisma/client';

/** Se usa sólo al publicar: cerrojos cortos por empresa, nunca durante búsqueda.
 * Las acciones de producción actualizan OrdenTrabajo antes de tocar sus pasos.
 * También se bloquean pasos y configuración para cubrir ediciones directas.
 * Tenant FOR UPDATE impide insertar nuevas filas hijas hasta cerrar la tx. */
export async function bloquearColaEntrega(
  tx: Prisma.TransactionClient,
  tenantId: string,
) {
  await tx.$queryRaw`SELECT "id" FROM "Tenant" WHERE "id" = ${tenantId}::uuid FOR UPDATE`;
  await tx.$queryRaw`SELECT "id" FROM "OrdenTrabajo" WHERE "tenantId" = ${tenantId}::uuid AND "estado" IN ('pendiente','produccion','borrador') ORDER BY "id" FOR UPDATE`;
  await tx.$queryRaw`SELECT "id" FROM "OrdenTrabajoItem" WHERE "tenantId" = ${tenantId}::uuid AND "ordenId" IN (SELECT "id" FROM "OrdenTrabajo" WHERE "tenantId" = ${tenantId}::uuid AND "estado" IN ('pendiente','produccion','borrador')) ORDER BY "id" FOR UPDATE`;
  await tx.$queryRaw`SELECT "id" FROM "OrdenTrabajoItemPaso" WHERE "tenantId" = ${tenantId}::uuid AND "estado" <> 'hecho' ORDER BY "id" FOR UPDATE`;
  for (const tabla of [
    'Estacion',
    'EquipoProduccion',
    'EstacionFamilia',
    'EstacionRegla',
    'Maquina',
    'ConfiguracionProduccion',
    'DiaNoLaborable',
    'DatosEmpresa',
  ])
    await tx.$queryRaw(
      Prisma.sql`SELECT "tenantId" FROM ${Prisma.raw('"' + tabla + '"')} WHERE "tenantId" = ${tenantId}::uuid FOR UPDATE`,
    );
}
