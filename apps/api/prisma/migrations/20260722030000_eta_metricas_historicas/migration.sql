-- Métricas históricas del ETA — F1: promesa + cierre.
-- El ETA se calculaba en el front y se descartaba; sin capturar la predicción
-- en el momento del hito, ninguna métrica de precisión es reconstruible.
-- Ver docs/eta-metricas-historicas-diseno.md

-- ── Descomposición del ciclo real, al cerrar el item (§4.4) ──
ALTER TABLE "OrdenTrabajoItem"
  ADD COLUMN "cicloTotalMin"     INTEGER,
  ADD COLUMN "trabajoRealMin"    INTEGER,
  ADD COLUMN "esperaCicloMin"    INTEGER,
  ADD COLUMN "trasladoMin"       INTEGER,
  ADD COLUMN "proveedorMin"      INTEGER,
  ADD COLUMN "flowEfficiencyPct" DECIMAL(5,1);

-- ── Promesa de ETA congelada por hito (§4.1) ──
CREATE TABLE "EtaPromesa" (
  "id"           UUID         NOT NULL DEFAULT gen_random_uuid(),
  "tenantId"     UUID         NOT NULL,
  "ordenId"      UUID         NOT NULL,
  "itemId"       UUID         NOT NULL,
  "hito"         TEXT         NOT NULL,
  "congeladaEl"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finEstimado"  TIMESTAMP(3),
  "sinEstimar"   BOOLEAN      NOT NULL DEFAULT false,
  "parcial"      BOOLEAN      NOT NULL DEFAULT false,
  "fechaEntrega" TIMESTAMP(3),
  "finReal"      TIMESTAMP(3),
  "errorMin"     INTEGER,
  CONSTRAINT "EtaPromesa_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EtaPromesa_tenantId_congeladaEl_idx"
  ON "EtaPromesa" ("tenantId", "congeladaEl");
CREATE INDEX "EtaPromesa_tenantId_itemId_idx"
  ON "EtaPromesa" ("tenantId", "itemId");

ALTER TABLE "EtaPromesa"
  ADD CONSTRAINT "EtaPromesa_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EtaPromesa"
  ADD CONSTRAINT "EtaPromesa_itemId_fkey"
  FOREIGN KEY ("itemId") REFERENCES "OrdenTrabajoItem" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
