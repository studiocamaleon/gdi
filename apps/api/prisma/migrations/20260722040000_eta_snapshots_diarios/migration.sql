-- Métricas históricas del ETA — F2: fotos diarias de colas.
-- El cron corre el motor una vez por día por tenant y snapshotea la cola
-- proyectada, para que colas/espera/utilización se vuelvan series.
-- Ver docs/eta-metricas-historicas-diseno.md §4.2/§4.3

-- ── Foto diaria por estación (§4.2) ──
CREATE TABLE "EtaSnapshotEstacion" (
  "id"               UUID         NOT NULL DEFAULT gen_random_uuid(),
  "tenantId"         UUID         NOT NULL,
  "fecha"            DATE         NOT NULL,
  "estacionKey"      TEXT         NOT NULL,
  "estacionNombre"   TEXT         NOT NULL,
  "colaMin"          INTEGER      NOT NULL,
  "horizonteDias"    DECIMAL(6,1),
  "esperaP50Min"     INTEGER      NOT NULL,
  "esperaP90Min"     INTEGER      NOT NULL,
  "contencionMax"    INTEGER      NOT NULL,
  "utilizacion5dPct" DECIMAL(5,1) NOT NULL,
  "pasosEnPlan"      INTEGER      NOT NULL,
  CONSTRAINT "EtaSnapshotEstacion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EtaSnapshotEstacion_tenantId_fecha_estacionKey_key"
  ON "EtaSnapshotEstacion" ("tenantId", "fecha", "estacionKey");
CREATE INDEX "EtaSnapshotEstacion_tenantId_estacionKey_fecha_idx"
  ON "EtaSnapshotEstacion" ("tenantId", "estacionKey", "fecha");

ALTER TABLE "EtaSnapshotEstacion"
  ADD CONSTRAINT "EtaSnapshotEstacion_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Foto diaria por item (§4.3) ──
CREATE TABLE "EtaSnapshotItem" (
  "id"          UUID         NOT NULL DEFAULT gen_random_uuid(),
  "tenantId"    UUID         NOT NULL,
  "itemId"      UUID         NOT NULL,
  "fecha"       DATE         NOT NULL,
  "finEstimado" TIMESTAMP(3),
  "sinEstimar"  BOOLEAN      NOT NULL,
  "parcial"     BOOLEAN      NOT NULL,
  "margenMin"   INTEGER,
  CONSTRAINT "EtaSnapshotItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EtaSnapshotItem_tenantId_fecha_itemId_key"
  ON "EtaSnapshotItem" ("tenantId", "fecha", "itemId");
CREATE INDEX "EtaSnapshotItem_tenantId_itemId_fecha_idx"
  ON "EtaSnapshotItem" ("tenantId", "itemId", "fecha");

ALTER TABLE "EtaSnapshotItem"
  ADD CONSTRAINT "EtaSnapshotItem_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
