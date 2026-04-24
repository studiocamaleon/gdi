-- CreateEnum
CREATE TYPE "TipoMovimientoStockMateriaPrima" AS ENUM (
  'INGRESO',
  'EGRESO',
  'AJUSTE_ENTRADA',
  'AJUSTE_SALIDA',
  'TRANSFERENCIA_SALIDA',
  'TRANSFERENCIA_ENTRADA'
);

-- CreateEnum
CREATE TYPE "OrigenMovimientoStockMateriaPrima" AS ENUM (
  'COMPRA',
  'CONSUMO_PRODUCCION',
  'AJUSTE_MANUAL',
  'TRANSFERENCIA',
  'DEVOLUCION',
  'OTRO'
);

-- CreateTable
CREATE TABLE "AlmacenMateriaPrima" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "codigo" TEXT NOT NULL,
  "nombre" TEXT NOT NULL,
  "descripcion" TEXT,
  "activo" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AlmacenMateriaPrima_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlmacenMateriaPrimaUbicacion" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "almacenId" UUID NOT NULL,
  "codigo" TEXT NOT NULL,
  "nombre" TEXT NOT NULL,
  "descripcion" TEXT,
  "activo" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AlmacenMateriaPrimaUbicacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMateriaPrimaVariante" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "varianteId" UUID NOT NULL,
  "ubicacionId" UUID NOT NULL,
  "cantidadDisponible" DECIMAL(14,4) NOT NULL,
  "costoPromedio" DECIMAL(14,6) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "StockMateriaPrimaVariante_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovimientoStockMateriaPrima" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "varianteId" UUID NOT NULL,
  "ubicacionId" UUID NOT NULL,
  "tipo" "TipoMovimientoStockMateriaPrima" NOT NULL,
  "origen" "OrigenMovimientoStockMateriaPrima" NOT NULL,
  "cantidad" DECIMAL(14,4) NOT NULL,
  "costoUnitario" DECIMAL(14,6),
  "saldoPosterior" DECIMAL(14,4) NOT NULL,
  "costoPromedioPost" DECIMAL(14,6) NOT NULL,
  "referenciaTipo" TEXT,
  "referenciaId" TEXT,
  "transferenciaId" UUID,
  "notas" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MovimientoStockMateriaPrima_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AlmacenMateriaPrima_tenantId_codigo_key" ON "AlmacenMateriaPrima"("tenantId", "codigo");

-- CreateIndex
CREATE INDEX "AlmacenMateriaPrima_tenantId_activo_idx" ON "AlmacenMateriaPrima"("tenantId", "activo");

-- CreateIndex
CREATE UNIQUE INDEX "AlmacenMateriaPrimaUbicacion_tenantId_almacenId_codigo_key" ON "AlmacenMateriaPrimaUbicacion"("tenantId", "almacenId", "codigo");

-- CreateIndex
CREATE INDEX "AlmacenMateriaPrimaUbicacion_tenantId_almacenId_activo_idx" ON "AlmacenMateriaPrimaUbicacion"("tenantId", "almacenId", "activo");

-- CreateIndex
CREATE UNIQUE INDEX "StockMateriaPrimaVariante_tenantId_varianteId_ubicacionId_key" ON "StockMateriaPrimaVariante"("tenantId", "varianteId", "ubicacionId");

-- CreateIndex
CREATE INDEX "StockMateriaPrimaVariante_tenantId_varianteId_idx" ON "StockMateriaPrimaVariante"("tenantId", "varianteId");

-- CreateIndex
CREATE INDEX "StockMateriaPrimaVariante_tenantId_ubicacionId_idx" ON "StockMateriaPrimaVariante"("tenantId", "ubicacionId");

-- CreateIndex
CREATE INDEX "MovimientoStockMateriaPrima_tenantId_varianteId_createdAt_idx" ON "MovimientoStockMateriaPrima"("tenantId", "varianteId", "createdAt");

-- CreateIndex
CREATE INDEX "MovimientoStockMateriaPrima_tenantId_ubicacionId_createdAt_idx" ON "MovimientoStockMateriaPrima"("tenantId", "ubicacionId", "createdAt");

-- CreateIndex
CREATE INDEX "MovimientoStockMateriaPrima_tenantId_tipo_createdAt_idx" ON "MovimientoStockMateriaPrima"("tenantId", "tipo", "createdAt");

-- CreateIndex
CREATE INDEX "MovimientoStockMateriaPrima_tenantId_referenciaTipo_referenciaId_idx" ON "MovimientoStockMateriaPrima"("tenantId", "referenciaTipo", "referenciaId");

-- CreateIndex
CREATE INDEX "MovimientoStockMateriaPrima_tenantId_transferenciaId_idx" ON "MovimientoStockMateriaPrima"("tenantId", "transferenciaId");

-- AddForeignKey
ALTER TABLE "AlmacenMateriaPrima" ADD CONSTRAINT "AlmacenMateriaPrima_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlmacenMateriaPrimaUbicacion" ADD CONSTRAINT "AlmacenMateriaPrimaUbicacion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlmacenMateriaPrimaUbicacion" ADD CONSTRAINT "AlmacenMateriaPrimaUbicacion_almacenId_fkey" FOREIGN KEY ("almacenId") REFERENCES "AlmacenMateriaPrima"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMateriaPrimaVariante" ADD CONSTRAINT "StockMateriaPrimaVariante_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMateriaPrimaVariante" ADD CONSTRAINT "StockMateriaPrimaVariante_varianteId_fkey" FOREIGN KEY ("varianteId") REFERENCES "MateriaPrimaVariante"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMateriaPrimaVariante" ADD CONSTRAINT "StockMateriaPrimaVariante_ubicacionId_fkey" FOREIGN KEY ("ubicacionId") REFERENCES "AlmacenMateriaPrimaUbicacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoStockMateriaPrima" ADD CONSTRAINT "MovimientoStockMateriaPrima_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoStockMateriaPrima" ADD CONSTRAINT "MovimientoStockMateriaPrima_varianteId_fkey" FOREIGN KEY ("varianteId") REFERENCES "MateriaPrimaVariante"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoStockMateriaPrima" ADD CONSTRAINT "MovimientoStockMateriaPrima_ubicacionId_fkey" FOREIGN KEY ("ubicacionId") REFERENCES "AlmacenMateriaPrimaUbicacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
