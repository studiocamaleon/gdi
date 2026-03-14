/*
  Warnings:

  - You are about to drop the `MateriaPrimaCompatibilidadMaquina` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "MateriaPrimaCompatibilidadMaquina" DROP CONSTRAINT "MateriaPrimaCompatibilidadMaquina_maquinaId_fkey";

-- DropForeignKey
ALTER TABLE "MateriaPrimaCompatibilidadMaquina" DROP CONSTRAINT "MateriaPrimaCompatibilidadMaquina_materiaPrimaId_fkey";

-- DropForeignKey
ALTER TABLE "MateriaPrimaCompatibilidadMaquina" DROP CONSTRAINT "MateriaPrimaCompatibilidadMaquina_perfilOperativoId_fkey";

-- DropForeignKey
ALTER TABLE "MateriaPrimaCompatibilidadMaquina" DROP CONSTRAINT "MateriaPrimaCompatibilidadMaquina_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "MateriaPrimaCompatibilidadMaquina" DROP CONSTRAINT "MateriaPrimaCompatibilidadMaquina_varianteId_fkey";

-- DropTable
DROP TABLE "MateriaPrimaCompatibilidadMaquina";

-- DropEnum
DROP TYPE "ModoUsoCompatibilidadMateriaPrima";

-- RenameIndex
ALTER INDEX "MaquinaComponenteDesgaste_tenantId_materiaPrimaVarianteId_activ" RENAME TO "MaquinaComponenteDesgaste_tenantId_materiaPrimaVarianteId_a_idx";

-- RenameIndex
ALTER INDEX "MovimientoStockMateriaPrima_tenantId_referenciaTipo_referenciaI" RENAME TO "MovimientoStockMateriaPrima_tenantId_referenciaTipo_referen_idx";
