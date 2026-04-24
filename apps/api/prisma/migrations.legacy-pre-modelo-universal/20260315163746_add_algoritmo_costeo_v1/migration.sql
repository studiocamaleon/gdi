-- CreateEnum
CREATE TYPE "EstadoAlgoritmoCosto" AS ENUM ('ACTIVO', 'INACTIVO');

-- CreateTable
CREATE TABLE "AlgoritmoCosto" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "estado" "EstadoAlgoritmoCosto" NOT NULL DEFAULT 'ACTIVO',
    "schemaJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlgoritmoCosto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductoVarianteAlgoritmoConfig" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "productoVarianteId" UUID NOT NULL,
    "algoritmoCostoId" UUID NOT NULL,
    "parametrosJson" JSONB NOT NULL,
    "versionConfig" INTEGER NOT NULL DEFAULT 1,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductoVarianteAlgoritmoConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CotizacionProductoSnapshot" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "productoVarianteId" UUID NOT NULL,
    "algoritmoCostoId" UUID NOT NULL,
    "algoritmoCodigo" TEXT NOT NULL,
    "algoritmoVersion" INTEGER NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "periodoTarifa" TEXT NOT NULL,
    "inputJson" JSONB NOT NULL,
    "resultadoJson" JSONB NOT NULL,
    "total" DECIMAL(14,6) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CotizacionProductoSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AlgoritmoCosto_tenantId_codigo_estado_idx" ON "AlgoritmoCosto"("tenantId", "codigo", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "AlgoritmoCosto_tenantId_codigo_version_key" ON "AlgoritmoCosto"("tenantId", "codigo", "version");

-- CreateIndex
CREATE INDEX "ProductoVarianteAlgoritmoConfig_tenantId_productoVarianteId_idx" ON "ProductoVarianteAlgoritmoConfig"("tenantId", "productoVarianteId", "activo");

-- CreateIndex
CREATE UNIQUE INDEX "ProductoVarianteAlgoritmoConfig_tenantId_productoVarianteId_key" ON "ProductoVarianteAlgoritmoConfig"("tenantId", "productoVarianteId", "algoritmoCostoId", "versionConfig");

-- CreateIndex
CREATE INDEX "CotizacionProductoSnapshot_tenantId_productoVarianteId_crea_idx" ON "CotizacionProductoSnapshot"("tenantId", "productoVarianteId", "createdAt");

-- CreateIndex
CREATE INDEX "CotizacionProductoSnapshot_tenantId_algoritmoCostoId_create_idx" ON "CotizacionProductoSnapshot"("tenantId", "algoritmoCostoId", "createdAt");

-- AddForeignKey
ALTER TABLE "AlgoritmoCosto" ADD CONSTRAINT "AlgoritmoCosto_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductoVarianteAlgoritmoConfig" ADD CONSTRAINT "ProductoVarianteAlgoritmoConfig_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductoVarianteAlgoritmoConfig" ADD CONSTRAINT "ProductoVarianteAlgoritmoConfig_productoVarianteId_fkey" FOREIGN KEY ("productoVarianteId") REFERENCES "ProductoVariante"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductoVarianteAlgoritmoConfig" ADD CONSTRAINT "ProductoVarianteAlgoritmoConfig_algoritmoCostoId_fkey" FOREIGN KEY ("algoritmoCostoId") REFERENCES "AlgoritmoCosto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CotizacionProductoSnapshot" ADD CONSTRAINT "CotizacionProductoSnapshot_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CotizacionProductoSnapshot" ADD CONSTRAINT "CotizacionProductoSnapshot_productoVarianteId_fkey" FOREIGN KEY ("productoVarianteId") REFERENCES "ProductoVariante"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CotizacionProductoSnapshot" ADD CONSTRAINT "CotizacionProductoSnapshot_algoritmoCostoId_fkey" FOREIGN KEY ("algoritmoCostoId") REFERENCES "AlgoritmoCosto"("id") ON DELETE CASCADE ON UPDATE CASCADE;
