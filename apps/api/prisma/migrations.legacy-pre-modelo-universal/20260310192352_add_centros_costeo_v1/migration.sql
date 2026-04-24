-- CreateEnum
CREATE TYPE "TipoRecursoCentroCosto" AS ENUM ('EMPLEADO', 'MAQUINARIA', 'PROVEEDOR', 'GASTO_MANUAL');

-- CreateEnum
CREATE TYPE "CategoriaComponenteCostoCentro" AS ENUM ('SUELDOS', 'CARGAS', 'MANTENIMIENTO', 'ENERGIA', 'ALQUILER', 'AMORTIZACION', 'TERCERIZACION', 'INSUMOS_INDIRECTOS', 'OTROS');

-- CreateEnum
CREATE TYPE "OrigenComponenteCostoCentro" AS ENUM ('MANUAL', 'SUGERIDO');

-- CreateEnum
CREATE TYPE "EstadoTarifaCentroCostoPeriodo" AS ENUM ('BORRADOR', 'PUBLICADA');

-- CreateTable
CREATE TABLE "CentroCostoRecurso" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "centroCostoId" UUID NOT NULL,
    "tipoRecurso" "TipoRecursoCentroCosto" NOT NULL,
    "empleadoId" UUID,
    "proveedorId" UUID,
    "nombreManual" TEXT,
    "descripcion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CentroCostoRecurso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CentroCostoComponenteCostoPeriodo" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "centroCostoId" UUID NOT NULL,
    "periodo" TEXT NOT NULL,
    "categoria" "CategoriaComponenteCostoCentro" NOT NULL,
    "nombre" TEXT NOT NULL,
    "origen" "OrigenComponenteCostoCentro" NOT NULL DEFAULT 'MANUAL',
    "importeMensual" DECIMAL(12,2) NOT NULL,
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CentroCostoComponenteCostoPeriodo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CentroCostoCapacidadPeriodo" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "centroCostoId" UUID NOT NULL,
    "periodo" TEXT NOT NULL,
    "unidadBase" "UnidadBaseCentroCosto" NOT NULL,
    "diasPorMes" DECIMAL(10,2) NOT NULL,
    "horasPorDia" DECIMAL(10,2) NOT NULL,
    "porcentajeNoProductivo" DECIMAL(5,2) NOT NULL,
    "capacidadTeorica" DECIMAL(12,2) NOT NULL,
    "capacidadPractica" DECIMAL(12,2) NOT NULL,
    "overrideManualCapacidad" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CentroCostoCapacidadPeriodo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CentroCostoTarifaPeriodo" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "centroCostoId" UUID NOT NULL,
    "periodo" TEXT NOT NULL,
    "costoMensualTotal" DECIMAL(12,2) NOT NULL,
    "capacidadPractica" DECIMAL(12,2) NOT NULL,
    "tarifaCalculada" DECIMAL(12,2) NOT NULL,
    "estado" "EstadoTarifaCentroCostoPeriodo" NOT NULL,
    "resumenJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CentroCostoTarifaPeriodo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CentroCostoRecurso_tenantId_centroCostoId_idx" ON "CentroCostoRecurso"("tenantId", "centroCostoId");

-- CreateIndex
CREATE INDEX "CentroCostoRecurso_tenantId_tipoRecurso_idx" ON "CentroCostoRecurso"("tenantId", "tipoRecurso");

-- CreateIndex
CREATE INDEX "CentroCostoComponenteCostoPeriodo_tenantId_centroCostoId_pe_idx" ON "CentroCostoComponenteCostoPeriodo"("tenantId", "centroCostoId", "periodo");

-- CreateIndex
CREATE UNIQUE INDEX "CentroCostoCapacidadPeriodo_tenantId_centroCostoId_periodo_key" ON "CentroCostoCapacidadPeriodo"("tenantId", "centroCostoId", "periodo");

-- CreateIndex
CREATE INDEX "CentroCostoTarifaPeriodo_tenantId_centroCostoId_periodo_idx" ON "CentroCostoTarifaPeriodo"("tenantId", "centroCostoId", "periodo");

-- CreateIndex
CREATE UNIQUE INDEX "CentroCostoTarifaPeriodo_tenantId_centroCostoId_periodo_est_key" ON "CentroCostoTarifaPeriodo"("tenantId", "centroCostoId", "periodo", "estado");

-- AddForeignKey
ALTER TABLE "CentroCostoRecurso" ADD CONSTRAINT "CentroCostoRecurso_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CentroCostoRecurso" ADD CONSTRAINT "CentroCostoRecurso_centroCostoId_fkey" FOREIGN KEY ("centroCostoId") REFERENCES "CentroCosto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CentroCostoRecurso" ADD CONSTRAINT "CentroCostoRecurso_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "Empleado"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CentroCostoRecurso" ADD CONSTRAINT "CentroCostoRecurso_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "Proveedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CentroCostoComponenteCostoPeriodo" ADD CONSTRAINT "CentroCostoComponenteCostoPeriodo_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CentroCostoComponenteCostoPeriodo" ADD CONSTRAINT "CentroCostoComponenteCostoPeriodo_centroCostoId_fkey" FOREIGN KEY ("centroCostoId") REFERENCES "CentroCosto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CentroCostoCapacidadPeriodo" ADD CONSTRAINT "CentroCostoCapacidadPeriodo_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CentroCostoCapacidadPeriodo" ADD CONSTRAINT "CentroCostoCapacidadPeriodo_centroCostoId_fkey" FOREIGN KEY ("centroCostoId") REFERENCES "CentroCosto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CentroCostoTarifaPeriodo" ADD CONSTRAINT "CentroCostoTarifaPeriodo_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CentroCostoTarifaPeriodo" ADD CONSTRAINT "CentroCostoTarifaPeriodo_centroCostoId_fkey" FOREIGN KEY ("centroCostoId") REFERENCES "CentroCosto"("id") ON DELETE CASCADE ON UPDATE CASCADE;
