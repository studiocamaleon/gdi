-- Rediseño "estaciones por reglas" (Fase B): la estación declara qué agrupa por
-- reglas (máquina / tecnología / paso / familia). Convive con EstacionFamilia y
-- Maquina.estacionId como fallback. Ver docs/estaciones-reglas-diseno.md.

CREATE TABLE "EstacionRegla" (
  "id"         UUID NOT NULL,
  "tenantId"   UUID NOT NULL,
  "estacionId" UUID NOT NULL,
  "tipo"       TEXT NOT NULL,
  "valor"      TEXT NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EstacionRegla_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EstacionRegla_estacionId_tipo_valor_key"
  ON "EstacionRegla" ("estacionId", "tipo", "valor");
CREATE INDEX "EstacionRegla_tenantId_tipo_valor_idx"
  ON "EstacionRegla" ("tenantId", "tipo", "valor");
CREATE INDEX "EstacionRegla_tenantId_estacionId_idx"
  ON "EstacionRegla" ("tenantId", "estacionId");

ALTER TABLE "EstacionRegla"
  ADD CONSTRAINT "EstacionRegla_estacionId_fkey"
  FOREIGN KEY ("estacionId") REFERENCES "Estacion"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
