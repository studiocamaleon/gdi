-- AlterTable
ALTER TABLE "CentroCostoTarifaPeriodo" ADD COLUMN     "costoMensualManoObra" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "tarifaManoObra" DECIMAL(12,2) NOT NULL DEFAULT 0;
