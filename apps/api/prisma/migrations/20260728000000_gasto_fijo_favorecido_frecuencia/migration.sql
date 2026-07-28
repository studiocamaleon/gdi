-- CreateEnum
CREATE TYPE "FrecuenciaGastoFijo" AS ENUM ('MENSUAL', 'BIMESTRAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL');

-- AlterTable
ALTER TABLE "GastoFijoEstructura" ADD COLUMN     "documento" TEXT,
ADD COLUMN     "frecuencia" "FrecuenciaGastoFijo" NOT NULL DEFAULT 'MENSUAL',
ADD COLUMN     "metodoPagoId" UUID,
ADD COLUMN     "proveedorId" UUID,
ADD COLUMN     "valor" DECIMAL(14,2) NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "GastoFijoEstructura_tenantId_proveedorId_idx" ON "GastoFijoEstructura"("tenantId", "proveedorId");

-- AddForeignKey
ALTER TABLE "GastoFijoEstructura" ADD CONSTRAINT "GastoFijoEstructura_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "Proveedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GastoFijoEstructura" ADD CONSTRAINT "GastoFijoEstructura_metodoPagoId_fkey" FOREIGN KEY ("metodoPagoId") REFERENCES "MetodoPago"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Las filas que ya existían son todas mensuales: el valor de la cuota y el
-- importe mensual coinciden. Sin esto quedarían con valor 0 y el formulario
-- mostraría un gasto vacío al abrirlas.
UPDATE "GastoFijoEstructura" SET "valor" = "importeMensual" WHERE "valor" = 0;
