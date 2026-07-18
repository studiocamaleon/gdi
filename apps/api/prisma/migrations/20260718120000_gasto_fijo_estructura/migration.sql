-- CreateEnum
CREATE TYPE "CategoriaGastoFijo" AS ENUM ('ALQUILER', 'SUELDOS', 'SERVICIOS', 'AMORTIZACION', 'FINANCIEROS', 'IMPUESTOS', 'MARKETING', 'OTROS');

-- CreateTable
CREATE TABLE "GastoFijoEstructura" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "categoria" "CategoriaGastoFijo" NOT NULL,
    "importeMensual" DECIMAL(14,2) NOT NULL,
    "vigenteDesde" TEXT NOT NULL,
    "vigenteHasta" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GastoFijoEstructura_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GastoFijoEstructura_tenantId_idx" ON "GastoFijoEstructura"("tenantId");

-- AddForeignKey
ALTER TABLE "GastoFijoEstructura" ADD CONSTRAINT "GastoFijoEstructura_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
