-- Modelo universal (Etapa C.1) — infraestructura de shadow mode.
-- Aditivo: los productos existentes quedan con motorPreferido=V1 (comportamiento actual).

-- CreateEnum
CREATE TYPE "MotorVersionPreferida" AS ENUM ('V1', 'V2', 'SHADOW');

-- AlterTable: agregar motorPreferido a ProductoServicio
ALTER TABLE "ProductoServicio"
  ADD COLUMN "motorPreferido" "MotorVersionPreferida" NOT NULL DEFAULT 'V1';

-- CreateTable: log de comparación v1 vs v2 en shadow mode
CREATE TABLE "CotizacionShadowLog" (
  "id"                 UUID           NOT NULL DEFAULT gen_random_uuid(),
  "tenantId"           UUID           NOT NULL,
  "productoServicioId" UUID           NOT NULL,
  "productoVarianteId" UUID,
  "motorCodigo"        TEXT           NOT NULL,
  "inputHash"          TEXT           NOT NULL,
  "totalV1"            DECIMAL(14, 6) NOT NULL,
  "totalV2"            DECIMAL(14, 6) NOT NULL,
  "diffAbsoluto"       DECIMAL(14, 6) NOT NULL,
  "diffPct"            DOUBLE PRECISION NOT NULL,
  "subtotalesV1"       JSONB          NOT NULL,
  "subtotalesV2"       JSONB          NOT NULL,
  "anomalias"          JSONB          NOT NULL,
  "createdAt"          TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CotizacionShadowLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CotizacionShadowLog_tenantId_motorCodigo_createdAt_idx"
  ON "CotizacionShadowLog" ("tenantId", "motorCodigo", "createdAt");
CREATE INDEX "CotizacionShadowLog_tenantId_productoServicioId_createdAt_idx"
  ON "CotizacionShadowLog" ("tenantId", "productoServicioId", "createdAt");
CREATE INDEX "CotizacionShadowLog_diffPct_idx"
  ON "CotizacionShadowLog" ("diffPct");

-- AddForeignKey
ALTER TABLE "CotizacionShadowLog" ADD CONSTRAINT "CotizacionShadowLog_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
