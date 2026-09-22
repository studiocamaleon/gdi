-- Separar los algoritmos en el editor sin modificar contratos publicados.
ALTER TABLE "PlanBorrador" ALTER COLUMN "catalogoVersion" SET DEFAULT 2;

UPDATE "PlanBorrador"
SET "contenido" = jsonb_set(
      "contenido", '{funciones,nesting_irregular}',
      CASE WHEN "codigo" IN ('pro', 'avanzado', 'cofounder-pro', 'cofounder-avanzado')
        AND "contenido" #> '{funciones,aprovechamiento_cotizacion}' = 'true'::jsonb
        THEN 'true'::jsonb ELSE 'false'::jsonb END
    ),
    "catalogoVersion" = 2,
    "revision" = "revision" + 1,
    "actualizadoEl" = CURRENT_TIMESTAMP
WHERE "catalogoVersion" = 1;
