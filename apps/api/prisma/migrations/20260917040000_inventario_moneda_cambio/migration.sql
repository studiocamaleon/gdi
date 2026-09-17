ALTER TABLE "DatosEmpresa" ADD COLUMN "tipoCambioConfig" JSONB;
CREATE TABLE "TipoCambioCotizacion" (
  "id" UUID NOT NULL, "tenantId" UUID NOT NULL, "snapshotJson" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TipoCambioCotizacion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TipoCambioCotizacion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "TipoCambioCotizacion_tenantId_createdAt_idx" ON "TipoCambioCotizacion"("tenantId", "createdAt");
ALTER TABLE "Cotizacion" ADD COLUMN "tipoCambioId" UUID;
ALTER TABLE "Cotizacion" ADD CONSTRAINT "Cotizacion_tipoCambioId_fkey" FOREIGN KEY ("tipoCambioId") REFERENCES "TipoCambioCotizacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- Fija la moneda histórica de los importes sin etiqueta; nunca reinterpreta los USD existentes.
UPDATE "MateriaPrimaVariante" v SET "moneda" = COALESCE((SELECT d."monedaCodigo" FROM "DatosEmpresa" d WHERE d."tenantId" = v."tenantId"), 'ARS') WHERE v."moneda" IS NULL OR BTRIM(v."moneda") = '';
