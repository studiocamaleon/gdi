-- AlterTable
ALTER TABLE "ProductoImpuestoCatalogo" ADD COLUMN     "alcance" TEXT NOT NULL DEFAULT 'PRODUCTO',
ADD COLUMN     "baseCalculo" TEXT NOT NULL DEFAULT 'NETO',
ADD COLUMN     "traslado" TEXT NOT NULL DEFAULT 'POR_DENTRO';

-- CreateIndex
CREATE INDEX "ProductoImpuestoCatalogo_tenantId_alcance_activo_idx" ON "ProductoImpuestoCatalogo"("tenantId", "alcance", "activo");

-- Data fix: los IVA existentes son impuestos POR_FUERA sobre el NETO (se agregan
-- y discriminan en factura); IIBB y débito/crédito son costos POR_DENTRO de
-- alcance TENANT (de la empresa, no del producto). El cheque aplica sobre el
-- BRUTO cobrado.
UPDATE "ProductoImpuestoCatalogo"
SET "traslado" = 'POR_FUERA', "baseCalculo" = 'NETO'
WHERE lower("codigo") LIKE '%iva%' OR lower("nombre") LIKE '%iva%';

UPDATE "ProductoImpuestoCatalogo"
SET "traslado" = 'POR_DENTRO', "baseCalculo" = 'NETO', "alcance" = 'TENANT'
WHERE lower("codigo") LIKE '%iibb%'
   OR lower("nombre") LIKE '%iibb%'
   OR lower("nombre") LIKE '%ingresos brutos%';

UPDATE "ProductoImpuestoCatalogo"
SET "traslado" = 'POR_DENTRO', "baseCalculo" = 'BRUTO_COBRADO', "alcance" = 'TENANT'
WHERE lower("codigo") LIKE '%cheque%'
   OR lower("nombre") LIKE '%cheque%'
   OR lower("nombre") LIKE '%debito%'
   OR lower("nombre") LIKE '%débito%';
