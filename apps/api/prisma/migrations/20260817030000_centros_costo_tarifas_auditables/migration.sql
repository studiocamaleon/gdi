CREATE TABLE "public"."CentroCostoTarifaRevision" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "centroCostoId" UUID NOT NULL,
    "periodo" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "costoMensualTotal" DECIMAL(12,2) NOT NULL,
    "capacidadPractica" DECIMAL(12,2) NOT NULL,
    "tarifaCalculada" DECIMAL(12,2) NOT NULL,
    "costoMensualManoObra" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "tarifaManoObra" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "resumenJson" JSONB NOT NULL,
    "publicadaPorUserId" UUID,
    "publicadaEl" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CentroCostoTarifaRevision_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CentroCostoTarifaRevision_tenantId_centroCostoId_periodo_revision_key"
ON "public"."CentroCostoTarifaRevision"("tenantId", "centroCostoId", "periodo", "revision");

CREATE INDEX "CentroCostoTarifaRevision_tenantId_centroCostoId_periodo_idx"
ON "public"."CentroCostoTarifaRevision"("tenantId", "centroCostoId", "periodo");

ALTER TABLE "public"."CentroCostoTarifaRevision"
ADD CONSTRAINT "CentroCostoTarifaRevision_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."CentroCostoTarifaRevision"
ADD CONSTRAINT "CentroCostoTarifaRevision_centroCostoId_fkey"
FOREIGN KEY ("centroCostoId") REFERENCES "public"."CentroCosto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "public"."CentroCostoTarifaRevision" (
  "id", "tenantId", "centroCostoId", "periodo", "revision",
  "costoMensualTotal", "capacidadPractica", "tarifaCalculada",
  "costoMensualManoObra", "tarifaManoObra", "resumenJson", "publicadaEl"
)
SELECT
  gen_random_uuid(), "tenantId", "centroCostoId", "periodo", 1,
  "costoMensualTotal", "capacidadPractica", "tarifaCalculada",
  "costoMensualManoObra", "tarifaManoObra", "resumenJson", "updatedAt"
FROM "public"."CentroCostoTarifaPeriodo"
WHERE "estado" = 'PUBLICADA';
