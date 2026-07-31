-- Fase 2 del modelo de impuestos: CATEGORÍA FISCAL por producto.
--
-- El IVA deja de "tildarse por producto": ahora el producto declara su
-- categoría ('general' | 'exento') y el motor la cruza con el régimen del
-- emisor (ConfiguracionFiscal.condicionFiscal) y con la fila de IVA del
-- catálogo etiquetada con esa misma categoría.
--
-- Neutralidad (AR, tenant Responsable Inscripto): 'general' resuelve a la MISMA
-- fila de IVA que hoy se tilda (iva_21) ⇒ mismo 21%, mismo snapshot, mismo
-- precio al centavo. Ver docs/impuestos-modelo-latam-diseno.md.

-- 1) Columnas nuevas.
ALTER TABLE "Producto"
  ADD COLUMN "categoriaFiscal" TEXT NOT NULL DEFAULT 'general';

ALTER TABLE "ProductoImpuestoCatalogo"
  ADD COLUMN "categoriaFiscal" TEXT;

-- 2) Etiquetar las filas de IVA (POR_FUERA a nivel PRODUCTO) como 'general':
--    son la alícuota general que el modelo por categoría va a resolver.
UPDATE "ProductoImpuestoCatalogo"
  SET "categoriaFiscal" = 'general'
  WHERE traslado = 'POR_FUERA' AND alcance = 'PRODUCTO';

-- 3) Backfill NEUTRAL de productos: los que HOY no tienen ningún IVA tildado
--    quedan 'exento' (conservan 0% IVA); el resto queda 'general' (el default)
--    ⇒ IVA igual que hoy. Preserva exactamente el comportamiento vigente.
UPDATE "Producto" p
  SET "categoriaFiscal" = 'exento'
  WHERE NOT EXISTS (
    SELECT 1
    FROM "ProductoImpuestoAplicado" ia
    JOIN "ProductoImpuestoCatalogo" c ON c.id = ia."impuestoCatalogoId"
    WHERE ia."productoId" = p.id
      AND c.traslado = 'POR_FUERA'
  );
