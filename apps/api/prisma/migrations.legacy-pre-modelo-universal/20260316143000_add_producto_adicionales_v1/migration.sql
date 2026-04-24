-- CreateEnum
CREATE TYPE "TipoProductoAdicional" AS ENUM ('SERVICIO', 'ACABADO');

-- CreateEnum
CREATE TYPE "MetodoCostoProductoAdicional" AS ENUM ('TIME_ONLY', 'TIME_PLUS_MATERIAL');

-- CreateEnum
CREATE TYPE "TipoConsumoAdicionalMaterial" AS ENUM ('POR_UNIDAD', 'POR_PLIEGO', 'POR_M2');

-- AlterTable
ALTER TABLE "ProcesoOperacion"
  ADD COLUMN "requiresProductoAdicionalId" UUID;

-- CreateTable
CREATE TABLE "ProductoAdicionalCatalogo" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "codigo" TEXT NOT NULL,
  "nombre" TEXT NOT NULL,
  "descripcion" TEXT,
  "tipo" "TipoProductoAdicional" NOT NULL,
  "metodoCosto" "MetodoCostoProductoAdicional" NOT NULL DEFAULT 'TIME_ONLY',
  "centroCostoId" UUID,
  "activo" BOOLEAN NOT NULL DEFAULT true,
  "metadataJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProductoAdicionalCatalogo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductoAdicionalMaterial" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "productoAdicionalId" UUID NOT NULL,
  "materiaPrimaVarianteId" UUID NOT NULL,
  "tipoConsumo" "TipoConsumoAdicionalMaterial" NOT NULL DEFAULT 'POR_UNIDAD',
  "factorConsumo" DECIMAL(14,6) NOT NULL,
  "mermaPct" DECIMAL(8,4),
  "activo" BOOLEAN NOT NULL DEFAULT true,
  "detalleJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProductoAdicionalMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductoServicioAdicional" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "productoServicioId" UUID NOT NULL,
  "productoAdicionalId" UUID NOT NULL,
  "activo" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProductoServicioAdicional_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductoVarianteAdicionalRestriction" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "productoVarianteId" UUID NOT NULL,
  "productoAdicionalId" UUID NOT NULL,
  "permitido" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProductoVarianteAdicionalRestriction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductoAdicionalCatalogo_tenantId_codigo_key" ON "ProductoAdicionalCatalogo"("tenantId", "codigo");
CREATE INDEX "ProductoAdicionalCatalogo_tenantId_nombre_activo_idx" ON "ProductoAdicionalCatalogo"("tenantId", "nombre", "activo");
CREATE INDEX "ProductoAdicionalCatalogo_tenantId_tipo_activo_idx" ON "ProductoAdicionalCatalogo"("tenantId", "tipo", "activo");
CREATE INDEX "ProductoAdicionalCatalogo_tenantId_centroCostoId_activo_idx" ON "ProductoAdicionalCatalogo"("tenantId", "centroCostoId", "activo");

CREATE INDEX "ProductoAdicionalMaterial_tenantId_productoAdicionalId_activo_idx" ON "ProductoAdicionalMaterial"("tenantId", "productoAdicionalId", "activo");
CREATE INDEX "ProductoAdicionalMaterial_tenantId_materiaPrimaVarianteId_activo_idx" ON "ProductoAdicionalMaterial"("tenantId", "materiaPrimaVarianteId", "activo");

CREATE UNIQUE INDEX "ProductoServicioAdicional_tenantId_productoServicioId_productoAdicionalId_key" ON "ProductoServicioAdicional"("tenantId", "productoServicioId", "productoAdicionalId");
CREATE INDEX "ProductoServicioAdicional_tenantId_productoServicioId_activo_idx" ON "ProductoServicioAdicional"("tenantId", "productoServicioId", "activo");
CREATE INDEX "ProductoServicioAdicional_tenantId_productoAdicionalId_activo_idx" ON "ProductoServicioAdicional"("tenantId", "productoAdicionalId", "activo");

CREATE UNIQUE INDEX "PVAR_ADIC_RESTR_uq_tenant_var_adic" ON "ProductoVarianteAdicionalRestriction"("tenantId", "productoVarianteId", "productoAdicionalId");
CREATE INDEX "PVAR_ADIC_RESTR_idx_tenant_var" ON "ProductoVarianteAdicionalRestriction"("tenantId", "productoVarianteId");
CREATE INDEX "PVAR_ADIC_RESTR_idx_tenant_adic" ON "ProductoVarianteAdicionalRestriction"("tenantId", "productoAdicionalId");

CREATE INDEX "ProcesoOperacion_tenantId_requiresProductoAdicionalId_idx" ON "ProcesoOperacion"("tenantId", "requiresProductoAdicionalId");

-- AddForeignKey
ALTER TABLE "ProductoAdicionalCatalogo"
  ADD CONSTRAINT "ProductoAdicionalCatalogo_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ProductoAdicionalCatalogo_centroCostoId_fkey" FOREIGN KEY ("centroCostoId") REFERENCES "CentroCosto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProductoAdicionalMaterial"
  ADD CONSTRAINT "ProductoAdicionalMaterial_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ProductoAdicionalMaterial_productoAdicionalId_fkey" FOREIGN KEY ("productoAdicionalId") REFERENCES "ProductoAdicionalCatalogo"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ProductoAdicionalMaterial_materiaPrimaVarianteId_fkey" FOREIGN KEY ("materiaPrimaVarianteId") REFERENCES "MateriaPrimaVariante"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProductoServicioAdicional"
  ADD CONSTRAINT "ProductoServicioAdicional_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ProductoServicioAdicional_productoServicioId_fkey" FOREIGN KEY ("productoServicioId") REFERENCES "ProductoServicio"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ProductoServicioAdicional_productoAdicionalId_fkey" FOREIGN KEY ("productoAdicionalId") REFERENCES "ProductoAdicionalCatalogo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProductoVarianteAdicionalRestriction"
  ADD CONSTRAINT "ProductoVarianteAdicionalRestriction_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ProductoVarianteAdicionalRestriction_productoVarianteId_fkey" FOREIGN KEY ("productoVarianteId") REFERENCES "ProductoVariante"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ProductoVarianteAdicionalRestriction_productoAdicionalId_fkey" FOREIGN KEY ("productoAdicionalId") REFERENCES "ProductoAdicionalCatalogo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProcesoOperacion"
  ADD CONSTRAINT "ProcesoOperacion_requiresProductoAdicionalId_fkey" FOREIGN KEY ("requiresProductoAdicionalId") REFERENCES "ProductoAdicionalCatalogo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
