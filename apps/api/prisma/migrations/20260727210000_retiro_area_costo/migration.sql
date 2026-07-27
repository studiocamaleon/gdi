-- DropForeignKey
ALTER TABLE "AreaCosto" DROP CONSTRAINT "AreaCosto_plantaId_fkey";

-- DropForeignKey
ALTER TABLE "AreaCosto" DROP CONSTRAINT "AreaCosto_tenantId_fkey";

-- DropTable
DROP TABLE "AreaCosto";

