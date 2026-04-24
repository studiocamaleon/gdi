-- Enums for process typing and controlled units
CREATE TYPE "TipoProceso" AS ENUM ('MAQUINARIA', 'MANUAL', 'MIXTO');
CREATE TYPE "UnidadProceso" AS ENUM (
  'NINGUNA',
  'HORA',
  'MINUTO',
  'HOJA',
  'COPIA',
  'A4_EQUIV',
  'M2',
  'METRO_LINEAL',
  'PIEZA',
  'CICLO',
  'UNIDAD',
  'KG',
  'LITRO',
  'LOTE'
);

-- ProcesoDefinicion alignment
ALTER TABLE "ProcesoDefinicion"
  ADD COLUMN "tipoProceso" "TipoProceso" NOT NULL DEFAULT 'MAQUINARIA',
  ADD COLUMN "currentVersion" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "ProcesoDefinicion"
  ALTER COLUMN "plantillaMaquinaria" DROP NOT NULL;

-- ProcesoOperacion units alignment (text -> controlled enum)
ALTER TABLE "ProcesoOperacion"
  ADD COLUMN "unidadEntrada_v2" "UnidadProceso" NOT NULL DEFAULT 'NINGUNA',
  ADD COLUMN "unidadSalida_v2" "UnidadProceso" NOT NULL DEFAULT 'NINGUNA',
  ADD COLUMN "unidadTiempo" "UnidadProceso" NOT NULL DEFAULT 'MINUTO';

UPDATE "ProcesoOperacion"
SET "unidadEntrada_v2" = CASE LOWER(COALESCE("unidadEntrada", ''))
  WHEN 'hora' THEN 'HORA'::"UnidadProceso"
  WHEN 'min' THEN 'MINUTO'::"UnidadProceso"
  WHEN 'minuto' THEN 'MINUTO'::"UnidadProceso"
  WHEN 'minutos' THEN 'MINUTO'::"UnidadProceso"
  WHEN 'hoja' THEN 'HOJA'::"UnidadProceso"
  WHEN 'copia' THEN 'COPIA'::"UnidadProceso"
  WHEN 'a4' THEN 'A4_EQUIV'::"UnidadProceso"
  WHEN 'a4_equiv' THEN 'A4_EQUIV'::"UnidadProceso"
  WHEN 'm2' THEN 'M2'::"UnidadProceso"
  WHEN 'metro_lineal' THEN 'METRO_LINEAL'::"UnidadProceso"
  WHEN 'pieza' THEN 'PIEZA'::"UnidadProceso"
  WHEN 'piezas' THEN 'PIEZA'::"UnidadProceso"
  WHEN 'ciclo' THEN 'CICLO'::"UnidadProceso"
  WHEN 'unidad' THEN 'UNIDAD'::"UnidadProceso"
  WHEN 'kg' THEN 'KG'::"UnidadProceso"
  WHEN 'litro' THEN 'LITRO'::"UnidadProceso"
  WHEN 'l' THEN 'LITRO'::"UnidadProceso"
  WHEN 'lote' THEN 'LOTE'::"UnidadProceso"
  ELSE 'NINGUNA'::"UnidadProceso"
END;

UPDATE "ProcesoOperacion"
SET "unidadSalida_v2" = CASE LOWER(COALESCE("unidadSalida", ''))
  WHEN 'hora' THEN 'HORA'::"UnidadProceso"
  WHEN 'min' THEN 'MINUTO'::"UnidadProceso"
  WHEN 'minuto' THEN 'MINUTO'::"UnidadProceso"
  WHEN 'minutos' THEN 'MINUTO'::"UnidadProceso"
  WHEN 'hoja' THEN 'HOJA'::"UnidadProceso"
  WHEN 'copia' THEN 'COPIA'::"UnidadProceso"
  WHEN 'a4' THEN 'A4_EQUIV'::"UnidadProceso"
  WHEN 'a4_equiv' THEN 'A4_EQUIV'::"UnidadProceso"
  WHEN 'm2' THEN 'M2'::"UnidadProceso"
  WHEN 'metro_lineal' THEN 'METRO_LINEAL'::"UnidadProceso"
  WHEN 'pieza' THEN 'PIEZA'::"UnidadProceso"
  WHEN 'piezas' THEN 'PIEZA'::"UnidadProceso"
  WHEN 'ciclo' THEN 'CICLO'::"UnidadProceso"
  WHEN 'unidad' THEN 'UNIDAD'::"UnidadProceso"
  WHEN 'kg' THEN 'KG'::"UnidadProceso"
  WHEN 'litro' THEN 'LITRO'::"UnidadProceso"
  WHEN 'l' THEN 'LITRO'::"UnidadProceso"
  WHEN 'lote' THEN 'LOTE'::"UnidadProceso"
  ELSE 'NINGUNA'::"UnidadProceso"
END;

ALTER TABLE "ProcesoOperacion" DROP COLUMN "unidadEntrada";
ALTER TABLE "ProcesoOperacion" DROP COLUMN "unidadSalida";
ALTER TABLE "ProcesoOperacion" RENAME COLUMN "unidadEntrada_v2" TO "unidadEntrada";
ALTER TABLE "ProcesoOperacion" RENAME COLUMN "unidadSalida_v2" TO "unidadSalida";

-- Versioning table
CREATE TABLE "ProcesoVersion" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "procesoDefinicionId" UUID NOT NULL,
  "version" INTEGER NOT NULL,
  "dataJson" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProcesoVersion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProcesoVersion_tenantId_procesoDefinicionId_version_key"
ON "ProcesoVersion"("tenantId", "procesoDefinicionId", "version");

CREATE INDEX "ProcesoVersion_tenantId_procesoDefinicionId_createdAt_idx"
ON "ProcesoVersion"("tenantId", "procesoDefinicionId", "createdAt");

ALTER TABLE "ProcesoVersion"
  ADD CONSTRAINT "ProcesoVersion_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProcesoVersion"
  ADD CONSTRAINT "ProcesoVersion_procesoDefinicionId_fkey"
  FOREIGN KEY ("procesoDefinicionId") REFERENCES "ProcesoDefinicion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
