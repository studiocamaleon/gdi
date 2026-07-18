-- Etapa A de facturación sobre órdenes / deuda comercial.
-- Ver docs/facturacion-ordenes-deuda-comercial-diseno.md §3 y §8.

-- AlterTable: campos nuevos de OrdenTrabajo
ALTER TABLE "OrdenTrabajo" ADD COLUMN "fechaFinalizada" TIMESTAMP(3),
ADD COLUMN "facturadoTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN "cobradoTotal" DECIMAL(14,2) NOT NULL DEFAULT 0;

-- CreateTable: ComprobanteOrden (factura <-> orden, M-a-M con monto)
CREATE TABLE "ComprobanteOrden" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "comprobanteId" UUID NOT NULL,
    "ordenId" UUID NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComprobanteOrden_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ComprobanteOrden_comprobanteId_ordenId_key" ON "ComprobanteOrden"("comprobanteId", "ordenId");
CREATE INDEX "ComprobanteOrden_tenantId_ordenId_idx" ON "ComprobanteOrden"("tenantId", "ordenId");

-- AddForeignKey
ALTER TABLE "ComprobanteOrden" ADD CONSTRAINT "ComprobanteOrden_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ComprobanteOrden" ADD CONSTRAINT "ComprobanteOrden_comprobanteId_fkey" FOREIGN KEY ("comprobanteId") REFERENCES "Comprobante"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ComprobanteOrden" ADD CONSTRAINT "ComprobanteOrden_ordenId_fkey" FOREIGN KEY ("ordenId") REFERENCES "OrdenTrabajo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- Backfill 1: Comprobante.ordenId (deprecado) -> ComprobanteOrden.
-- Cada comprobante histórico vinculado a una orden se reparte entero
-- a esa orden (monto = total del comprobante).
-- ============================================================
INSERT INTO "ComprobanteOrden" ("id", "tenantId", "comprobanteId", "ordenId", "monto")
SELECT gen_random_uuid(), c."tenantId", c."id", c."ordenId", c."total"
FROM "Comprobante" c
WHERE c."ordenId" IS NOT NULL;

-- ============================================================
-- Backfill 2: fechaFinalizada.
-- Fuente primaria: el evento de estado más viejo cuyo destino fue
-- 'finalizada' (datosJson.despues, escrito por ambos caminos: cambio
-- manual y auto-finalización del Tablero). Fallback para órdenes hoy
-- finalizadas/entregadas sin evento (históricas): updatedAt.
-- ============================================================
UPDATE "OrdenTrabajo" ot
SET "fechaFinalizada" = ev.primera
FROM (
  SELECT "ordenId", MIN("fecha") AS primera
  FROM "OrdenTrabajoEvento"
  WHERE "tipo" = 'estado'
    AND "datosJson" ->> 'despues' = 'finalizada'
  GROUP BY "ordenId"
) ev
WHERE ev."ordenId" = ot."id";

UPDATE "OrdenTrabajo"
SET "fechaFinalizada" = "updatedAt"
WHERE "fechaFinalizada" IS NULL
  AND "estado" IN ('finalizada', 'entregada');

-- ============================================================
-- Backfill 3: denormalizados facturadoTotal / cobradoTotal.
-- facturadoTotal: facturas suman, notas de crédito restan; sólo
-- comprobantes EMITIDOS y no anulados (borradores/rechazados no
-- cuentan ni reservan cupo). Piso 0 por si una NC histórica excede.
-- cobradoTotal: bruto de cobros no anulados de la orden.
-- ============================================================
UPDATE "OrdenTrabajo" ot
SET "facturadoTotal" = agg.monto
FROM (
  SELECT co."ordenId",
         GREATEST(0, SUM(
           CASE
             WHEN c."tipo" = 'nota_credito' THEN -co."monto"
             WHEN c."tipo" = 'factura' THEN co."monto"
             ELSE 0
           END
         )) AS monto
  FROM "ComprobanteOrden" co
  JOIN "Comprobante" c ON c."id" = co."comprobanteId"
  WHERE c."estado" = 'emitido' AND c."anuladoEl" IS NULL
  GROUP BY co."ordenId"
) agg
WHERE agg."ordenId" = ot."id";

UPDATE "OrdenTrabajo" ot
SET "cobradoTotal" = agg.monto
FROM (
  SELECT "ordenId", SUM("montoBruto") AS monto
  FROM "Cobro"
  WHERE "ordenId" IS NOT NULL AND "anuladoEl" IS NULL
  GROUP BY "ordenId"
) agg
WHERE agg."ordenId" = ot."id";
