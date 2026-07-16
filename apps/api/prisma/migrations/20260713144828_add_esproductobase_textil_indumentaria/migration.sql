-- AlterEnum
ALTER TYPE "SubfamiliaMateriaPrima" ADD VALUE 'TEXTIL_INDUMENTARIA';

-- AlterTable
ALTER TABLE "MateriaPrima" ADD COLUMN     "esProductoBase" BOOLEAN NOT NULL DEFAULT false;
