ALTER TABLE "ProductoServicio"
ADD COLUMN "unidadComercial" TEXT NOT NULL DEFAULT 'unidad';

UPDATE "ProductoServicio" AS p
SET "unidadComercial" = COALESCE(
  CASE
    WHEN p."motorCodigo" = 'gran_formato'
      THEN CASE
        WHEN COALESCE(p."detalleJson"->'granFormato'->>'tipoVenta', 'm2') = 'metro_lineal'
          THEN 'metro_lineal'
        ELSE 'm2'
      END
    ELSE NULL
  END,
  NULLIF(
    TRIM(
      COALESCE(
        (
          SELECT sf."unidadComercial"
          FROM "SubfamiliaProducto" AS sf
          WHERE sf."id" = p."subfamiliaProductoId"
        ),
        ''
      )
    ),
    ''
  ),
  'unidad'
);
