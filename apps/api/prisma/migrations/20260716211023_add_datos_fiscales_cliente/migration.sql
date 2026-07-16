-- AlterTable
ALTER TABLE "Cliente" ADD COLUMN     "condicionFiscal" TEXT NOT NULL DEFAULT 'consumidor_final',
ADD COLUMN     "cuit" VARCHAR(11),
ADD COLUMN     "limiteCredito" DECIMAL(14,2);
