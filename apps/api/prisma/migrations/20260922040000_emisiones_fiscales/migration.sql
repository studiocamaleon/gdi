ALTER TABLE "Comprobante" ADD COLUMN "emisorSnapshot" JSONB;

CREATE TABLE "ComprobanteEmision" (
  "id" UUID NOT NULL PRIMARY KEY,
  "tenantId" UUID NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "comprobanteId" UUID NOT NULL REFERENCES "Comprobante"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "proveedor" TEXT NOT NULL,
  "ambiente" TEXT NOT NULL,
  "cuitOperativo" TEXT NOT NULL,
  "serie" TEXT NOT NULL,
  "serieActiva" TEXT,
  "estado" TEXT NOT NULL CHECK ("estado" IN ('preparando','enviando','verificar','emitido','rechazado','sin_envio')),
  "solicitudJson" JSONB NOT NULL,
  "respuestaJson" JSONB,
  "emisorJson" JSONB NOT NULL,
  "numero" INTEGER,
  "detalle" TEXT,
  "solicitadaPorId" UUID NOT NULL,
  "consultadaPorId" UUID,
  "consultadaEl" TIMESTAMP(3),
  "creadaEl" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "enviadaEl" TIMESTAMP(3),
  "finalizadaEl" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ComprobanteEmision_serie_estado" CHECK (
    ("estado" IN ('preparando','enviando','verificar') AND "serieActiva" IS NOT NULL AND "serieActiva" = "serie") OR
    ("estado" IN ('emitido','rechazado','sin_envio') AND "serieActiva" IS NULL)
  )
);
CREATE UNIQUE INDEX "ComprobanteEmision_serieActiva_key" ON "ComprobanteEmision"("serieActiva");
CREATE UNIQUE INDEX "ComprobanteEmision_comprobante_activo" ON "ComprobanteEmision"("comprobanteId")
  WHERE "estado" IN ('preparando','enviando','verificar');
CREATE INDEX "ComprobanteEmision_tenantId_comprobanteId_creadaEl_idx" ON "ComprobanteEmision"("tenantId","comprobanteId","creadaEl");
CREATE INDEX "ComprobanteEmision_tenantId_estado_idx" ON "ComprobanteEmision"("tenantId","estado");
