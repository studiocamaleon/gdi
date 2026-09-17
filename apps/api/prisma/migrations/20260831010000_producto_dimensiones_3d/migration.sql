-- Fase 4.2.3: el producto pasa a ser dueño de su contrato dimensional.
ALTER TABLE "Producto"
  ADD COLUMN "dimensionesRequeridas" TEXT[] NOT NULL DEFAULT ARRAY['ANCHO', 'ALTO']::TEXT[],
  ADD COLUMN "medidaDefaultProfundidadMm" DECIMAL(12,2);

-- Compatibilidad: FIJA sin ninguna medida era la representación histórica de
-- un producto vendido por unidad que no usa dimensiones.
UPDATE "Producto"
SET "dimensionesRequeridas" = ARRAY[]::TEXT[]
WHERE "unidadComercial" = 'unidad'
  AND "modoMedidas" = 'FIJA'
  AND "medidaDefaultAnchoMm" IS NULL
  AND "medidaDefaultAltoMm" IS NULL
  AND (
    "medidasPredefinidasJson" IS NULL
    OR "medidasPredefinidasJson" = 'null'::jsonb
    OR "medidasPredefinidasJson" = '[]'::jsonb
  );

-- Los bastidores dobles que históricamente originaban profundidad desde el
-- paso se convierten en productos 3D. El valor fijo se copia como default del
-- producto, pero el campo viejo permanece durante la ventana de compatibilidad.
WITH bastidores AS (
  SELECT DISTINCT ON (pra."productoId")
    pra."productoId",
    CASE
      WHEN COALESCE(pcp."paramsPasoJson"->>'profundidadMm', '') ~ '^[0-9]+([.][0-9]+)?$'
      THEN (pcp."paramsPasoJson"->>'profundidadMm')::DECIMAL(12,2)
      ELSE NULL
    END AS profundidad_mm
  FROM "ProductoRutaAlternativa" pra
  JOIN "ProductoConfigPaso" pcp
    ON pcp."productoRutaAlternativaId" = pra.id
   AND pcp.activo = true
  JOIN "RutaPaso" rp
    ON rp.id = pcp."rutaPasoId"
  WHERE pra.activo = true
    AND rp."familiaCodigo" = 'estructura_bastidor'
    AND lower(COALESCE(pcp."paramsPasoJson"->>'tipoBastidor', 'doble')) <> 'simple'
  ORDER BY pra."productoId", pra."esPreferida" DESC, pra.orden ASC
)
UPDATE "Producto" producto
SET
  "dimensionesRequeridas" = ARRAY['ANCHO', 'ALTO', 'PROFUNDIDAD']::TEXT[],
  "medidaDefaultProfundidadMm" = COALESCE(
    producto."medidaDefaultProfundidadMm",
    bastidores.profundidad_mm
  )
FROM bastidores
WHERE producto.id = bastidores."productoId";

COMMENT ON COLUMN "Producto"."dimensionesRequeridas" IS
  'Contrato comercial de ejes requeridos. No se infiere de rutas o familias de pasos.';
COMMENT ON COLUMN "Producto"."medidaDefaultProfundidadMm" IS
  'Profundidad fija/default del producto en mm cuando declara eje PROFUNDIDAD.';
