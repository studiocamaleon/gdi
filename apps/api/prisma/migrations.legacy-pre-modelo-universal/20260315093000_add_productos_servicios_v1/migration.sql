-- CreateEnum
CREATE TYPE "TipoProductoServicio" AS ENUM ('PRODUCTO', 'SERVICIO');

-- CreateEnum
CREATE TYPE "EstadoProductoServicio" AS ENUM ('ACTIVO', 'INACTIVO');

-- CreateEnum
CREATE TYPE "EstadoProductoVersion" AS ENUM ('BORRADOR', 'PUBLICADA');

-- CreateEnum
CREATE TYPE "PoliticaCostoMaterial" AS ENUM ('PRECIO_REFERENCIA', 'COSTO_PROMEDIO_STOCK');

-- CreateTable
CREATE TABLE "FamiliaProducto" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "codigo" TEXT NOT NULL,
  "nombre" TEXT NOT NULL,
  "activo" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FamiliaProducto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubfamiliaProducto" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "familiaProductoId" UUID NOT NULL,
  "codigo" TEXT NOT NULL,
  "nombre" TEXT NOT NULL,
  "unidadComercial" TEXT,
  "activo" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SubfamiliaProducto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductoServicio" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "tipo" "TipoProductoServicio" NOT NULL,
  "codigo" TEXT NOT NULL,
  "nombre" TEXT NOT NULL,
  "descripcion" TEXT,
  "familiaProductoId" UUID NOT NULL,
  "subfamiliaProductoId" UUID,
  "estado" "EstadoProductoServicio" NOT NULL DEFAULT 'ACTIVO',
  "activo" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProductoServicio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductoVersion" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "productoServicioId" UUID NOT NULL,
  "familiaProductoId" UUID NOT NULL,
  "subfamiliaProductoId" UUID,
  "version" INTEGER NOT NULL,
  "nombreVersion" TEXT,
  "estado" "EstadoProductoVersion" NOT NULL DEFAULT 'BORRADOR',
  "vigenteDesde" TIMESTAMP(3),
  "vigenteHasta" TIMESTAMP(3),
  "politicaCostoMaterial" "PoliticaCostoMaterial" NOT NULL DEFAULT 'PRECIO_REFERENCIA',
  "parametrosJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProductoVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductoRutaPasoVersion" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "productoVersionId" UUID NOT NULL,
  "orden" INTEGER NOT NULL,
  "nombre" TEXT NOT NULL,
  "centroCostoId" UUID NOT NULL,
  "setupMin" DECIMAL(12,2),
  "runMinPorUnidad" DECIMAL(12,4),
  "cleanupMin" DECIMAL(12,2),
  "tiempoFijoMin" DECIMAL(12,2),
  "activo" BOOLEAN NOT NULL DEFAULT true,
  "detalleJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProductoRutaPasoVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductoMaterialVersion" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "productoVersionId" UUID NOT NULL,
  "orden" INTEGER NOT NULL,
  "nombre" TEXT NOT NULL,
  "pasoNombre" TEXT,
  "varianteId" UUID NOT NULL,
  "cantidadBase" DECIMAL(14,4) NOT NULL,
  "unidadTecnica" TEXT NOT NULL,
  "mermaPct" DECIMAL(8,4),
  "formatoObjetivo" TEXT,
  "reglaValorizacion" "PoliticaCostoMaterial",
  "detalleJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProductoMaterialVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductoTercerizadoVersion" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "productoVersionId" UUID NOT NULL,
  "orden" INTEGER NOT NULL,
  "nombre" TEXT NOT NULL,
  "proveedorId" UUID,
  "unidad" TEXT NOT NULL,
  "cantidadBase" DECIMAL(14,4) NOT NULL,
  "precioUnitario" DECIMAL(14,6) NOT NULL,
  "detalleJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProductoTercerizadoVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReglaConversionFormatoTenant" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "formatoPadre" TEXT NOT NULL,
  "formatoHijo" TEXT NOT NULL,
  "rendimientoTeorico" DECIMAL(14,6) NOT NULL,
  "mermaFijaHijo" DECIMAL(14,4),
  "mermaPctHijo" DECIMAL(8,4),
  "gramajeMin" DECIMAL(10,2),
  "gramajeMax" DECIMAL(10,2),
  "acabadoIncluye" TEXT,
  "activo" BOOLEAN NOT NULL DEFAULT true,
  "prioridad" INTEGER NOT NULL DEFAULT 100,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReglaConversionFormatoTenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostoSnapshotItem" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "productoServicioId" UUID NOT NULL,
  "productoVersionId" UUID NOT NULL,
  "referenciaTipo" TEXT NOT NULL,
  "referenciaId" TEXT,
  "cantidadCotizada" DECIMAL(14,4) NOT NULL,
  "moneda" VARCHAR(3) NOT NULL DEFAULT 'USD',
  "detalleJson" JSONB NOT NULL,
  "totalItem" DECIMAL(14,6) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CostoSnapshotItem_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "FamiliaProducto_tenantId_codigo_key" ON "FamiliaProducto"("tenantId", "codigo");
CREATE INDEX "FamiliaProducto_tenantId_nombre_activo_idx" ON "FamiliaProducto"("tenantId", "nombre", "activo");

CREATE UNIQUE INDEX "SubfamiliaProducto_tenantId_familiaProductoId_codigo_key" ON "SubfamiliaProducto"("tenantId", "familiaProductoId", "codigo");
CREATE INDEX "SubfamiliaProducto_tenantId_familiaProductoId_nombre_activo_idx" ON "SubfamiliaProducto"("tenantId", "familiaProductoId", "nombre", "activo");

CREATE UNIQUE INDEX "ProductoServicio_tenantId_codigo_key" ON "ProductoServicio"("tenantId", "codigo");
CREATE INDEX "ProductoServicio_tenantId_nombre_activo_idx" ON "ProductoServicio"("tenantId", "nombre", "activo");
CREATE INDEX "ProductoServicio_tenantId_familiaProductoId_subfamiliaProductoId_idx" ON "ProductoServicio"("tenantId", "familiaProductoId", "subfamiliaProductoId");

CREATE UNIQUE INDEX "ProductoVersion_tenantId_productoServicioId_version_key" ON "ProductoVersion"("tenantId", "productoServicioId", "version");
CREATE INDEX "ProductoVersion_tenantId_productoServicioId_estado_idx" ON "ProductoVersion"("tenantId", "productoServicioId", "estado");

CREATE UNIQUE INDEX "ProductoRutaPasoVersion_tenantId_productoVersionId_orden_key" ON "ProductoRutaPasoVersion"("tenantId", "productoVersionId", "orden");
CREATE INDEX "ProductoRutaPasoVersion_tenantId_productoVersionId_idx" ON "ProductoRutaPasoVersion"("tenantId", "productoVersionId");

CREATE UNIQUE INDEX "ProductoMaterialVersion_tenantId_productoVersionId_orden_key" ON "ProductoMaterialVersion"("tenantId", "productoVersionId", "orden");
CREATE INDEX "ProductoMaterialVersion_tenantId_productoVersionId_idx" ON "ProductoMaterialVersion"("tenantId", "productoVersionId");
CREATE INDEX "ProductoMaterialVersion_tenantId_varianteId_idx" ON "ProductoMaterialVersion"("tenantId", "varianteId");

CREATE UNIQUE INDEX "ProductoTercerizadoVersion_tenantId_productoVersionId_orden_key" ON "ProductoTercerizadoVersion"("tenantId", "productoVersionId", "orden");
CREATE INDEX "ProductoTercerizadoVersion_tenantId_productoVersionId_idx" ON "ProductoTercerizadoVersion"("tenantId", "productoVersionId");
CREATE INDEX "ProductoTercerizadoVersion_tenantId_proveedorId_idx" ON "ProductoTercerizadoVersion"("tenantId", "proveedorId");

CREATE UNIQUE INDEX "ReglaConversionFormatoTenant_tenantId_formatoPadre_formatoHijo_prioridad_key" ON "ReglaConversionFormatoTenant"("tenantId", "formatoPadre", "formatoHijo", "prioridad");
CREATE INDEX "ReglaConversionFormatoTenant_tenantId_formatoHijo_activo_idx" ON "ReglaConversionFormatoTenant"("tenantId", "formatoHijo", "activo");

CREATE INDEX "CostoSnapshotItem_tenantId_productoServicioId_createdAt_idx" ON "CostoSnapshotItem"("tenantId", "productoServicioId", "createdAt");
CREATE INDEX "CostoSnapshotItem_tenantId_productoVersionId_createdAt_idx" ON "CostoSnapshotItem"("tenantId", "productoVersionId", "createdAt");
CREATE INDEX "CostoSnapshotItem_tenantId_referenciaTipo_referenciaId_idx" ON "CostoSnapshotItem"("tenantId", "referenciaTipo", "referenciaId");

-- FKs
ALTER TABLE "FamiliaProducto" ADD CONSTRAINT "FamiliaProducto_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SubfamiliaProducto" ADD CONSTRAINT "SubfamiliaProducto_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubfamiliaProducto" ADD CONSTRAINT "SubfamiliaProducto_familiaProductoId_fkey" FOREIGN KEY ("familiaProductoId") REFERENCES "FamiliaProducto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProductoServicio" ADD CONSTRAINT "ProductoServicio_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductoServicio" ADD CONSTRAINT "ProductoServicio_familiaProductoId_fkey" FOREIGN KEY ("familiaProductoId") REFERENCES "FamiliaProducto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductoServicio" ADD CONSTRAINT "ProductoServicio_subfamiliaProductoId_fkey" FOREIGN KEY ("subfamiliaProductoId") REFERENCES "SubfamiliaProducto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProductoVersion" ADD CONSTRAINT "ProductoVersion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductoVersion" ADD CONSTRAINT "ProductoVersion_productoServicioId_fkey" FOREIGN KEY ("productoServicioId") REFERENCES "ProductoServicio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductoVersion" ADD CONSTRAINT "ProductoVersion_familiaProductoId_fkey" FOREIGN KEY ("familiaProductoId") REFERENCES "FamiliaProducto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductoVersion" ADD CONSTRAINT "ProductoVersion_subfamiliaProductoId_fkey" FOREIGN KEY ("subfamiliaProductoId") REFERENCES "SubfamiliaProducto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProductoRutaPasoVersion" ADD CONSTRAINT "ProductoRutaPasoVersion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductoRutaPasoVersion" ADD CONSTRAINT "ProductoRutaPasoVersion_productoVersionId_fkey" FOREIGN KEY ("productoVersionId") REFERENCES "ProductoVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductoRutaPasoVersion" ADD CONSTRAINT "ProductoRutaPasoVersion_centroCostoId_fkey" FOREIGN KEY ("centroCostoId") REFERENCES "CentroCosto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProductoMaterialVersion" ADD CONSTRAINT "ProductoMaterialVersion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductoMaterialVersion" ADD CONSTRAINT "ProductoMaterialVersion_productoVersionId_fkey" FOREIGN KEY ("productoVersionId") REFERENCES "ProductoVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductoMaterialVersion" ADD CONSTRAINT "ProductoMaterialVersion_varianteId_fkey" FOREIGN KEY ("varianteId") REFERENCES "MateriaPrimaVariante"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProductoTercerizadoVersion" ADD CONSTRAINT "ProductoTercerizadoVersion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductoTercerizadoVersion" ADD CONSTRAINT "ProductoTercerizadoVersion_productoVersionId_fkey" FOREIGN KEY ("productoVersionId") REFERENCES "ProductoVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductoTercerizadoVersion" ADD CONSTRAINT "ProductoTercerizadoVersion_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "Proveedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ReglaConversionFormatoTenant" ADD CONSTRAINT "ReglaConversionFormatoTenant_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CostoSnapshotItem" ADD CONSTRAINT "CostoSnapshotItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CostoSnapshotItem" ADD CONSTRAINT "CostoSnapshotItem_productoServicioId_fkey" FOREIGN KEY ("productoServicioId") REFERENCES "ProductoServicio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CostoSnapshotItem" ADD CONSTRAINT "CostoSnapshotItem_productoVersionId_fkey" FOREIGN KEY ("productoVersionId") REFERENCES "ProductoVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
