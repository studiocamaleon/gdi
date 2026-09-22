import type { Prisma } from '@prisma/client';

/** Foto del trabajo registrado, sin consultar equipos, perfiles ni archivos.
 * La revisión identifica los pendientes, no sólo su cantidad: reemplazar un
 * trabajo por otro también invalida un diagnóstico ya aceptado. */
export async function contarContinuidadImpresion(
  tx: Prisma.TransactionClient,
  tenantId: string,
) {
  const [fila] = await tx.$queryRaw<
    Array<{
      sinEnvio: bigint;
      sinVerificar: bigint;
      revisionSinEnvio: string;
      revisionSinVerificar: string;
    }>
  >`
    WITH ultimos AS (
      SELECT DISTINCT ON (e."ordenId", e."datosJson"->>'itemId', COALESCE(e."datosJson"->>'pagina', '0'))
        e.id, e."ordenId", e."datosJson"
      FROM "OrdenTrabajoEvento" e
      JOIN "OrdenTrabajo" o ON o.id = e."ordenId" AND o."tenantId" = e."tenantId"
      WHERE e."tenantId" = ${tenantId}::uuid AND e.tipo = 'impresion_documento'
        AND o.estado NOT IN ('borrador', 'cancelada')
      ORDER BY e."ordenId", e."datosJson"->>'itemId', COALESCE(e."datosJson"->>'pagina', '0'), e.fecha DESC, e.id DESC
    ), sin_envio AS (
      SELECT e.id
      FROM "OrdenTrabajoEvento" e
      JOIN "OrdenTrabajo" o ON o.id = e."ordenId" AND o."tenantId" = e."tenantId"
      JOIN "OrdenTrabajoItem" i ON i.id::text = e."datosJson"->>'itemId'
        AND i."ordenId" = e."ordenId" AND i."tenantId" = e."tenantId"
      WHERE e."tenantId" = ${tenantId}::uuid AND e.tipo = 'cola_impresion'
        AND o.estado NOT IN ('borrador', 'cancelada')
        AND COALESCE(e."datosJson"->>'estado', 'PENDIENTE') <> 'VERIFICADO'
        AND NOT EXISTS (
          SELECT 1 FROM ultimos u WHERE u."ordenId" = e."ordenId"
            AND u."datosJson"->>'itemId' = e."datosJson"->>'itemId'
            AND COALESCE(u."datosJson"->>'pagina', '0') = COALESCE(e."datosJson"->>'pagina', '0')
        )
    ), sin_verificar AS (
      SELECT id FROM ultimos WHERE "datosJson"->>'confirmacion' IS NULL
    )
    SELECT
      (SELECT COUNT(*) FROM sin_envio) AS "sinEnvio",
      (SELECT COUNT(*) FROM sin_verificar) AS "sinVerificar",
      (SELECT md5(COALESCE(string_agg(id::text, ',' ORDER BY id), '')) FROM sin_envio) AS "revisionSinEnvio",
      (SELECT md5(COALESCE(string_agg(id::text, ',' ORDER BY id), '')) FROM sin_verificar) AS "revisionSinVerificar"`;
  return {
    sinEnvio: Number(fila.sinEnvio),
    sinVerificar: Number(fila.sinVerificar),
    revisionSinEnvio: fila.revisionSinEnvio,
    revisionSinVerificar: fila.revisionSinVerificar,
  };
}
