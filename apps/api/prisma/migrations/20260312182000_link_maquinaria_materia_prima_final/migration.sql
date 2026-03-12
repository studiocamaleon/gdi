-- Materia Prima flags
ALTER TABLE "MateriaPrima"
  ADD COLUMN IF NOT EXISTS "esConsumible" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "esRepuesto" BOOLEAN NOT NULL DEFAULT false;

-- New FK columns (temporary nullable for backfill)
ALTER TABLE "MaquinaConsumible"
  ADD COLUMN IF NOT EXISTS "materiaPrimaVarianteId" UUID;

ALTER TABLE "MaquinaComponenteDesgaste"
  ADD COLUMN IF NOT EXISTS "materiaPrimaVarianteId" UUID;

-- Seed placeholders per tenant (consumible)
INSERT INTO "MateriaPrima" (
  "id",
  "tenantId",
  "codigo",
  "nombre",
  "descripcion",
  "familia",
  "subfamilia",
  "tipoTecnico",
  "templateId",
  "unidadStock",
  "unidadCompra",
  "esConsumible",
  "esRepuesto",
  "activo",
  "atributosTecnicosJson",
  "createdAt",
  "updatedAt"
)
SELECT
  (
    substr(md5(mc."tenantId" || ':mp-consumible-mig'), 1, 8) || '-' ||
    substr(md5(mc."tenantId" || ':mp-consumible-mig'), 9, 4) || '-' ||
    substr(md5(mc."tenantId" || ':mp-consumible-mig'), 13, 4) || '-' ||
    substr(md5(mc."tenantId" || ':mp-consumible-mig'), 17, 4) || '-' ||
    substr(md5(mc."tenantId" || ':mp-consumible-mig'), 21, 12)
  )::uuid,
  mc."tenantId",
  'MP-CONSUMIBLE-MIG',
  'Consumible generico (migracion)',
  'Registro autogenerado para vincular maquinaria con materia prima.',
  'QUIMICO_AUXILIAR'::"FamiliaMateriaPrima",
  'AUXILIAR_PROCESO'::"SubfamiliaMateriaPrima",
  'consumible_generico',
  'consumible_generico_v1',
  'UNIDAD'::"UnidadMateriaPrima",
  'UNIDAD'::"UnidadMateriaPrima",
  true,
  false,
  true,
  '{}'::jsonb,
  now(),
  now()
FROM (SELECT DISTINCT "tenantId" FROM "MaquinaConsumible") mc
WHERE NOT EXISTS (
  SELECT 1
  FROM "MateriaPrima" mp
  WHERE mp."tenantId" = mc."tenantId"
    AND mp."codigo" = 'MP-CONSUMIBLE-MIG'
);

INSERT INTO "MateriaPrimaVariante" (
  "id",
  "tenantId",
  "materiaPrimaId",
  "sku",
  "nombreVariante",
  "activo",
  "atributosVarianteJson",
  "unidadStock",
  "unidadCompra",
  "precioReferencia",
  "moneda",
  "proveedorReferenciaId",
  "createdAt",
  "updatedAt"
)
SELECT
  (
    substr(md5(mp."tenantId" || ':mpv-consumible-mig'), 1, 8) || '-' ||
    substr(md5(mp."tenantId" || ':mpv-consumible-mig'), 9, 4) || '-' ||
    substr(md5(mp."tenantId" || ':mpv-consumible-mig'), 13, 4) || '-' ||
    substr(md5(mp."tenantId" || ':mpv-consumible-mig'), 17, 4) || '-' ||
    substr(md5(mp."tenantId" || ':mpv-consumible-mig'), 21, 12)
  )::uuid,
  mp."tenantId",
  mp."id",
  'MPV-CONSUMIBLE-MIG',
  'Variante migracion',
  true,
  '{}'::jsonb,
  'UNIDAD'::"UnidadMateriaPrima",
  'UNIDAD'::"UnidadMateriaPrima",
  0,
  NULL,
  NULL,
  now(),
  now()
FROM "MateriaPrima" mp
WHERE mp."codigo" = 'MP-CONSUMIBLE-MIG'
  AND NOT EXISTS (
    SELECT 1
    FROM "MateriaPrimaVariante" v
    WHERE v."tenantId" = mp."tenantId"
      AND v."sku" = 'MPV-CONSUMIBLE-MIG'
  );

-- Seed placeholders per tenant (repuesto)
INSERT INTO "MateriaPrima" (
  "id",
  "tenantId",
  "codigo",
  "nombre",
  "descripcion",
  "familia",
  "subfamilia",
  "tipoTecnico",
  "templateId",
  "unidadStock",
  "unidadCompra",
  "esConsumible",
  "esRepuesto",
  "activo",
  "atributosTecnicosJson",
  "createdAt",
  "updatedAt"
)
SELECT
  (
    substr(md5(md."tenantId" || ':mp-repuesto-mig'), 1, 8) || '-' ||
    substr(md5(md."tenantId" || ':mp-repuesto-mig'), 9, 4) || '-' ||
    substr(md5(md."tenantId" || ':mp-repuesto-mig'), 13, 4) || '-' ||
    substr(md5(md."tenantId" || ':mp-repuesto-mig'), 17, 4) || '-' ||
    substr(md5(md."tenantId" || ':mp-repuesto-mig'), 21, 12)
  )::uuid,
  md."tenantId",
  'MP-REPUESTO-MIG',
  'Repuesto generico (migracion)',
  'Registro autogenerado para vincular maquinaria con materia prima.',
  'HERRAJE_ACCESORIO'::"FamiliaMateriaPrima",
  'FIJACION_AUXILIAR'::"SubfamiliaMateriaPrima",
  'repuesto_generico',
  'repuesto_generico_v1',
  'UNIDAD'::"UnidadMateriaPrima",
  'UNIDAD'::"UnidadMateriaPrima",
  false,
  true,
  true,
  '{}'::jsonb,
  now(),
  now()
FROM (SELECT DISTINCT "tenantId" FROM "MaquinaComponenteDesgaste") md
WHERE NOT EXISTS (
  SELECT 1
  FROM "MateriaPrima" mp
  WHERE mp."tenantId" = md."tenantId"
    AND mp."codigo" = 'MP-REPUESTO-MIG'
);

INSERT INTO "MateriaPrimaVariante" (
  "id",
  "tenantId",
  "materiaPrimaId",
  "sku",
  "nombreVariante",
  "activo",
  "atributosVarianteJson",
  "unidadStock",
  "unidadCompra",
  "precioReferencia",
  "moneda",
  "proveedorReferenciaId",
  "createdAt",
  "updatedAt"
)
SELECT
  (
    substr(md5(mp."tenantId" || ':mpv-repuesto-mig'), 1, 8) || '-' ||
    substr(md5(mp."tenantId" || ':mpv-repuesto-mig'), 9, 4) || '-' ||
    substr(md5(mp."tenantId" || ':mpv-repuesto-mig'), 13, 4) || '-' ||
    substr(md5(mp."tenantId" || ':mpv-repuesto-mig'), 17, 4) || '-' ||
    substr(md5(mp."tenantId" || ':mpv-repuesto-mig'), 21, 12)
  )::uuid,
  mp."tenantId",
  mp."id",
  'MPV-REPUESTO-MIG',
  'Variante migracion',
  true,
  '{}'::jsonb,
  'UNIDAD'::"UnidadMateriaPrima",
  'UNIDAD'::"UnidadMateriaPrima",
  0,
  NULL,
  NULL,
  now(),
  now()
FROM "MateriaPrima" mp
WHERE mp."codigo" = 'MP-REPUESTO-MIG'
  AND NOT EXISTS (
    SELECT 1
    FROM "MateriaPrimaVariante" v
    WHERE v."tenantId" = mp."tenantId"
      AND v."sku" = 'MPV-REPUESTO-MIG'
  );

-- Backfill new FK columns
UPDATE "MaquinaConsumible" mc
SET "materiaPrimaVarianteId" = v."id"
FROM "MateriaPrima" mp
JOIN "MateriaPrimaVariante" v ON v."materiaPrimaId" = mp."id" AND v."tenantId" = mp."tenantId"
WHERE mp."tenantId" = mc."tenantId"
  AND mp."codigo" = 'MP-CONSUMIBLE-MIG'
  AND v."sku" = 'MPV-CONSUMIBLE-MIG'
  AND mc."materiaPrimaVarianteId" IS NULL;

UPDATE "MaquinaComponenteDesgaste" md
SET "materiaPrimaVarianteId" = v."id"
FROM "MateriaPrima" mp
JOIN "MateriaPrimaVariante" v ON v."materiaPrimaId" = mp."id" AND v."tenantId" = mp."tenantId"
WHERE mp."tenantId" = md."tenantId"
  AND mp."codigo" = 'MP-REPUESTO-MIG'
  AND v."sku" = 'MPV-REPUESTO-MIG'
  AND md."materiaPrimaVarianteId" IS NULL;

-- Apply constraints and indexes
ALTER TABLE "MaquinaConsumible"
  ALTER COLUMN "materiaPrimaVarianteId" SET NOT NULL;

ALTER TABLE "MaquinaComponenteDesgaste"
  ALTER COLUMN "materiaPrimaVarianteId" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'MaquinaConsumible_materiaPrimaVarianteId_fkey'
  ) THEN
    ALTER TABLE "MaquinaConsumible"
      ADD CONSTRAINT "MaquinaConsumible_materiaPrimaVarianteId_fkey"
      FOREIGN KEY ("materiaPrimaVarianteId") REFERENCES "MateriaPrimaVariante"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'MaquinaComponenteDesgaste_materiaPrimaVarianteId_fkey'
  ) THEN
    ALTER TABLE "MaquinaComponenteDesgaste"
      ADD CONSTRAINT "MaquinaComponenteDesgaste_materiaPrimaVarianteId_fkey"
      FOREIGN KEY ("materiaPrimaVarianteId") REFERENCES "MateriaPrimaVariante"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "MaquinaConsumible_tenantId_materiaPrimaVarianteId_activo_idx"
  ON "MaquinaConsumible"("tenantId", "materiaPrimaVarianteId", "activo");

CREATE INDEX IF NOT EXISTS "MaquinaComponenteDesgaste_tenantId_materiaPrimaVarianteId_activo_idx"
  ON "MaquinaComponenteDesgaste"("tenantId", "materiaPrimaVarianteId", "activo");

-- Remove legacy cost fields
ALTER TABLE "MaquinaConsumible"
  DROP COLUMN IF EXISTS "costoReferencia";

ALTER TABLE "MaquinaComponenteDesgaste"
  DROP COLUMN IF EXISTS "costoReposicion";
