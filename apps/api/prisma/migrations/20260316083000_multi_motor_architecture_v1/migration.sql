CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Producto: asignacion de motor de costo
ALTER TABLE "ProductoServicio"
  ADD COLUMN "motorCodigo" TEXT NOT NULL DEFAULT 'impresion_digital_laser',
  ADD COLUMN "motorVersion" INTEGER NOT NULL DEFAULT 1;

-- Configuracion base por producto
CREATE TABLE "ProductoMotorConfig" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "productoServicioId" UUID NOT NULL,
  "motorCodigo" TEXT NOT NULL,
  "motorVersion" INTEGER NOT NULL,
  "parametrosJson" JSONB NOT NULL,
  "versionConfig" INTEGER NOT NULL DEFAULT 1,
  "activo" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProductoMotorConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductoMotorConfig_tenantId_productoServicioId_motorCodigo_motorVersion_versionConfig_key"
  ON "ProductoMotorConfig"("tenantId", "productoServicioId", "motorCodigo", "motorVersion", "versionConfig");

CREATE INDEX "ProductoMotorConfig_tenantId_productoServicioId_activo_idx"
  ON "ProductoMotorConfig"("tenantId", "productoServicioId", "activo");

ALTER TABLE "ProductoMotorConfig"
  ADD CONSTRAINT "ProductoMotorConfig_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ProductoMotorConfig_productoServicioId_fkey" FOREIGN KEY ("productoServicioId") REFERENCES "ProductoServicio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Override opcional por variante
CREATE TABLE "ProductoVarianteMotorOverride" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "productoVarianteId" UUID NOT NULL,
  "motorCodigo" TEXT NOT NULL,
  "motorVersion" INTEGER NOT NULL,
  "parametrosJson" JSONB NOT NULL,
  "versionConfig" INTEGER NOT NULL DEFAULT 1,
  "activo" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProductoVarianteMotorOverride_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductoVarianteMotorOverride_tenantId_productoVarianteId_motorCodigo_motorVersion_versionConfig_key"
  ON "ProductoVarianteMotorOverride"("tenantId", "productoVarianteId", "motorCodigo", "motorVersion", "versionConfig");

CREATE INDEX "ProductoVarianteMotorOverride_tenantId_productoVarianteId_activo_idx"
  ON "ProductoVarianteMotorOverride"("tenantId", "productoVarianteId", "activo");

ALTER TABLE "ProductoVarianteMotorOverride"
  ADD CONSTRAINT "ProductoVarianteMotorOverride_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ProductoVarianteMotorOverride_productoVarianteId_fkey" FOREIGN KEY ("productoVarianteId") REFERENCES "ProductoVariante"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Snapshots pasan a trazabilidad por motor
ALTER TABLE "CotizacionProductoSnapshot"
  ADD COLUMN "motorCodigo" TEXT,
  ADD COLUMN "motorVersion" INTEGER,
  ADD COLUMN "configVersionBase" INTEGER,
  ADD COLUMN "configVersionOverride" INTEGER;

UPDATE "CotizacionProductoSnapshot" s
SET "motorCodigo" = COALESCE(a."codigo", s."algoritmoCodigo", 'impresion_digital_laser'),
    "motorVersion" = COALESCE(a."version", s."algoritmoVersion", 1)
FROM "AlgoritmoCosto" a
WHERE s."algoritmoCostoId" = a."id";

UPDATE "CotizacionProductoSnapshot"
SET "motorCodigo" = COALESCE("motorCodigo", 'impresion_digital_laser'),
    "motorVersion" = COALESCE("motorVersion", 1);

ALTER TABLE "CotizacionProductoSnapshot"
  ALTER COLUMN "motorCodigo" SET NOT NULL,
  ALTER COLUMN "motorVersion" SET NOT NULL;

CREATE INDEX "CotizacionProductoSnapshot_tenantId_motorCodigo_motorVersion_createdAt_idx"
  ON "CotizacionProductoSnapshot"("tenantId", "motorCodigo", "motorVersion", "createdAt");

DROP INDEX IF EXISTS "CotizacionProductoSnapshot_tenantId_algoritmoCostoId_create_idx";
ALTER TABLE "CotizacionProductoSnapshot" DROP CONSTRAINT IF EXISTS "CotizacionProductoSnapshot_algoritmoCostoId_fkey";

ALTER TABLE "CotizacionProductoSnapshot"
  DROP COLUMN "algoritmoCostoId",
  DROP COLUMN "algoritmoCodigo",
  DROP COLUMN "algoritmoVersion";

-- Migracion de configuracion legacy -> base producto + override por variante
WITH latest_cfg AS (
  SELECT
    cfg."tenantId",
    cfg."productoVarianteId",
    pv."productoServicioId",
    COALESCE(ac."codigo", 'impresion_digital_laser') AS "motorCodigo",
    COALESCE(ac."version", 1) AS "motorVersion",
    cfg."parametrosJson",
    cfg."versionConfig",
    ROW_NUMBER() OVER (
      PARTITION BY cfg."tenantId", cfg."productoVarianteId"
      ORDER BY cfg."versionConfig" DESC, cfg."createdAt" DESC
    ) AS rn
  FROM "ProductoVarianteAlgoritmoConfig" cfg
  JOIN "ProductoVariante" pv ON pv."id" = cfg."productoVarianteId"
  LEFT JOIN "AlgoritmoCosto" ac ON ac."id" = cfg."algoritmoCostoId"
  WHERE cfg."activo" = true
),
latest_per_variant AS (
  SELECT * FROM latest_cfg WHERE rn = 1
),
base_candidate AS (
  SELECT DISTINCT ON ("tenantId", "productoServicioId")
    "tenantId",
    "productoServicioId",
    "motorCodigo",
    "motorVersion",
    "parametrosJson"
  FROM latest_per_variant
  ORDER BY "tenantId", "productoServicioId", "productoVarianteId" ASC
),
insert_base AS (
  INSERT INTO "ProductoMotorConfig" (
    "id", "tenantId", "productoServicioId", "motorCodigo", "motorVersion", "parametrosJson", "versionConfig", "activo", "createdAt", "updatedAt"
  )
  SELECT
    gen_random_uuid(),
    b."tenantId",
    b."productoServicioId",
    b."motorCodigo",
    b."motorVersion",
    b."parametrosJson",
    1,
    true,
    now(),
    now()
  FROM base_candidate b
  LEFT JOIN "ProductoMotorConfig" existing
    ON existing."tenantId" = b."tenantId"
   AND existing."productoServicioId" = b."productoServicioId"
   AND existing."motorCodigo" = b."motorCodigo"
   AND existing."motorVersion" = b."motorVersion"
   AND existing."activo" = true
  WHERE existing."id" IS NULL
  RETURNING 1
)
INSERT INTO "ProductoVarianteMotorOverride" (
  "id", "tenantId", "productoVarianteId", "motorCodigo", "motorVersion", "parametrosJson", "versionConfig", "activo", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid(),
  v."tenantId",
  v."productoVarianteId",
  v."motorCodigo",
  v."motorVersion",
  v."parametrosJson",
  1,
  true,
  now(),
  now()
FROM latest_per_variant v
JOIN base_candidate b
  ON b."tenantId" = v."tenantId"
 AND b."productoServicioId" = v."productoServicioId"
 AND b."motorCodigo" = v."motorCodigo"
 AND b."motorVersion" = v."motorVersion"
LEFT JOIN "ProductoVarianteMotorOverride" existing
  ON existing."tenantId" = v."tenantId"
 AND existing."productoVarianteId" = v."productoVarianteId"
 AND existing."motorCodigo" = v."motorCodigo"
 AND existing."motorVersion" = v."motorVersion"
 AND existing."activo" = true
WHERE existing."id" IS NULL
  AND v."parametrosJson"::text <> b."parametrosJson"::text;

-- Asegurar motor por producto para todos los registros actuales
UPDATE "ProductoServicio"
SET "motorCodigo" = 'impresion_digital_laser',
    "motorVersion" = 1
WHERE "motorCodigo" IS NULL
   OR "motorVersion" IS NULL;
