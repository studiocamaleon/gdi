DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'MaquinaPerfilOperativo' AND column_name = 'modoTrabajo'
  ) THEN
    ALTER TABLE "MaquinaPerfilOperativo" RENAME COLUMN "modoTrabajo" TO "operationMode";
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'MaquinaPerfilOperativo' AND column_name = 'modoImpresionPerfil'
  ) THEN
    ALTER TABLE "MaquinaPerfilOperativo" RENAME COLUMN "modoImpresionPerfil" TO "printMode";
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'MaquinaPerfilOperativo' AND column_name = 'carasPerfil'
  ) THEN
    ALTER TABLE "MaquinaPerfilOperativo" RENAME COLUMN "carasPerfil" TO "printSides";
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'MaquinaPerfilOperativo' AND column_name = 'productividad'
  ) THEN
    ALTER TABLE "MaquinaPerfilOperativo" RENAME COLUMN "productividad" TO "productivityValue";
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'MaquinaPerfilOperativo' AND column_name = 'unidadProductividad'
  ) THEN
    ALTER TABLE "MaquinaPerfilOperativo" RENAME COLUMN "unidadProductividad" TO "productivityUnit";
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'MaquinaPerfilOperativo' AND column_name = 'tiempoPreparacionMin'
  ) THEN
    ALTER TABLE "MaquinaPerfilOperativo" RENAME COLUMN "tiempoPreparacionMin" TO "setupMin";
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'MaquinaPerfilOperativo' AND column_name = 'tiempoRipMin'
  ) THEN
    ALTER TABLE "MaquinaPerfilOperativo" RENAME COLUMN "tiempoRipMin" TO "cleanupMin";
  END IF;
END $$;

ALTER TABLE "MaquinaPerfilOperativo"
  ADD COLUMN IF NOT EXISTS "feedReloadMin" DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS "sheetThicknessMm" DECIMAL(12,3),
  ADD COLUMN IF NOT EXISTS "maxBatchHeightMm" DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS "materialPreset" TEXT;

UPDATE "MaquinaPerfilOperativo"
SET
  "feedReloadMin" = COALESCE(
    "feedReloadMin",
    NULLIF(("detalleJson" ->> 'recargaTandaMin'), '')::decimal
  ),
  "sheetThicknessMm" = COALESCE(
    "sheetThicknessMm",
    NULLIF(("detalleJson" ->> 'espesorHojaMm'), '')::decimal
  ),
  "maxBatchHeightMm" = COALESCE(
    "maxBatchHeightMm",
    NULLIF(("detalleJson" ->> 'alturaMaxTandaMm'), '')::decimal
  ),
  "materialPreset" = COALESCE(
    "materialPreset",
    NULLIF(("detalleJson" ->> 'papelGramajePreset'), '')
  );

UPDATE "MaquinaPerfilOperativo"
SET "detalleJson" =
  CASE
    WHEN "detalleJson" IS NULL THEN NULL
    ELSE
      "detalleJson"
      - 'recargaTandaMin'
      - 'espesorHojaMm'
      - 'alturaMaxTandaMm'
      - 'papelGramajePreset'
      - 'setupBaseMin'
      - 'cortesMinPerfil'
      - 'modoImpresion'
      - 'carasPerfil'
  END;
