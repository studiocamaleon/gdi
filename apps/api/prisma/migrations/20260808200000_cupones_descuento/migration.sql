-- Cupones de descuento (F4 — docs/descuentos-diseno.md §5.3). Aditivo:
-- catálogo + redenciones + traza del cupón en el item de la orden.

CREATE TABLE "Cupon" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "descripcion" TEXT,
    "tipo" TEXT NOT NULL,
    "valor" DECIMAL(14,2) NOT NULL,
    "alcanceTipo" TEXT NOT NULL DEFAULT 'ORDEN',
    "alcanceRef" TEXT,
    "montoMinimo" DECIMAL(14,2),
    "vigenciaDesde" TIMESTAMP(3),
    "vigenciaHasta" TIMESTAMP(3),
    "usoMax" INTEGER,
    "usoCount" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cupon_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CuponRedencion" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "cuponId" UUID NOT NULL,
    "ordenId" UUID NOT NULL,
    "montoAplicado" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CuponRedencion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Cupon_tenantId_codigo_key" ON "Cupon"("tenantId", "codigo");
CREATE INDEX "Cupon_tenantId_activo_idx" ON "Cupon"("tenantId", "activo");
CREATE UNIQUE INDEX "CuponRedencion_cuponId_ordenId_key" ON "CuponRedencion"("cuponId", "ordenId");
CREATE INDEX "CuponRedencion_tenantId_cuponId_idx" ON "CuponRedencion"("tenantId", "cuponId");

ALTER TABLE "Cupon" ADD CONSTRAINT "Cupon_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CuponRedencion" ADD CONSTRAINT "CuponRedencion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CuponRedencion" ADD CONSTRAINT "CuponRedencion_cuponId_fkey" FOREIGN KEY ("cuponId") REFERENCES "Cupon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrdenTrabajoItem" ADD COLUMN "descuentoCuponId" UUID;
