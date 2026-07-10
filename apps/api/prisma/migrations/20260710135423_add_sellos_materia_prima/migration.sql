-- AlterEnum
ALTER TYPE "FamiliaMateriaPrima" ADD VALUE 'SELLOS';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "SubfamiliaMateriaPrima" ADD VALUE 'SELLOS_AUTOMATICOS';
ALTER TYPE "SubfamiliaMateriaPrima" ADD VALUE 'SELLOS_MANUALES';
ALTER TYPE "SubfamiliaMateriaPrima" ADD VALUE 'GOMA_LASERABLE';
