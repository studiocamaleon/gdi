/*
  Warnings:

  - You are about to drop the column `arquetipoCodigo` on the `RutaPaso` table. All the data in the column will be lost.
  - You are about to drop the column `descripcionVisible` on the `RutaPaso` table. All the data in the column will be lost.
  - You are about to drop the column `nombreVisible` on the `RutaPaso` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "MaterialPreset" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "MaterialPresetVariante" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ProductoCategoriaComercial" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ProductoConfigPasoSlotMaterialCandidato" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ProductoConfigPasoSlotMaterialCandidatoVariante" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ProductoSubcategoriaComercial" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "RutaPaso" DROP COLUMN "arquetipoCodigo",
DROP COLUMN "descripcionVisible",
DROP COLUMN "nombreVisible";

-- RenameForeignKey
ALTER TABLE "MateriaPrimaVariante" RENAME CONSTRAINT "MateriaPrimaVariante_presetVar_fkey" TO "MateriaPrimaVariante_materialPresetVarianteId_fkey";

-- RenameForeignKey
ALTER TABLE "ProductoConfigPasoSlotMaterialCandidato" RENAME CONSTRAINT "SlotMaterialCand_default_variant_fkey" TO "ProductoConfigPasoSlotMaterialCandidato_defaultVarianteId_fkey";

-- RenameForeignKey
ALTER TABLE "ProductoConfigPasoSlotMaterialCandidato" RENAME CONSTRAINT "SlotMaterialCand_materia_fkey" TO "ProductoConfigPasoSlotMaterialCandidato_materiaPrimaId_fkey";

-- RenameForeignKey
ALTER TABLE "ProductoConfigPasoSlotMaterialCandidato" RENAME CONSTRAINT "SlotMaterialCand_slot_fkey" TO "ProductoConfigPasoSlotMaterialCandidato_slotMaterialId_fkey";

-- RenameForeignKey
ALTER TABLE "ProductoConfigPasoSlotMaterialCandidato" RENAME CONSTRAINT "SlotMaterialCand_tenant_fkey" TO "ProductoConfigPasoSlotMaterialCandidato_tenantId_fkey";

-- RenameForeignKey
ALTER TABLE "ProductoConfigPasoSlotMaterialCandidatoVariante" RENAME CONSTRAINT "SlotMaterialCandVar_candidate_fkey" TO "ProductoConfigPasoSlotMaterialCandidatoVariante_candidatoI_fkey";

-- RenameForeignKey
ALTER TABLE "ProductoConfigPasoSlotMaterialCandidatoVariante" RENAME CONSTRAINT "SlotMaterialCandVar_tenant_fkey" TO "ProductoConfigPasoSlotMaterialCandidatoVariante_tenantId_fkey";

-- RenameForeignKey
ALTER TABLE "ProductoConfigPasoSlotMaterialCandidatoVariante" RENAME CONSTRAINT "SlotMaterialCandVar_variant_fkey" TO "ProductoConfigPasoSlotMaterialCandidatoVariante_varianteId_fkey";

-- RenameIndex
ALTER INDEX "MateriaPrima_tenant_canonicalKey_idx" RENAME TO "MateriaPrima_tenantId_canonicalMaterialKey_idx";

-- RenameIndex
ALTER INDEX "MateriaPrimaVariante_presetVar_idx" RENAME TO "MateriaPrimaVariante_materialPresetVarianteId_idx";

-- RenameIndex
ALTER INDEX "MaterialPreset_fam_sub_act_idx" RENAME TO "MaterialPreset_familia_subfamilia_activo_idx";

-- RenameIndex
ALTER INDEX "MaterialPresetVariante_preset_act_ord_idx" RENAME TO "MaterialPresetVariante_presetId_activo_orden_idx";

-- RenameIndex
ALTER INDEX "MaterialPresetVariante_preset_sku_key" RENAME TO "MaterialPresetVariante_presetId_skuSugerido_key";

-- RenameIndex
ALTER INDEX "ProductoConfigPasoMaquinaCandidata_tenantId_perfilDefaul_idx" RENAME TO "ProductoConfigPasoMaquinaCandidata_tenantId_perfilDefaultId_idx";

-- RenameIndex
ALTER INDEX "SlotMaterialCand_tenant_materia_idx" RENAME TO "ProductoConfigPasoSlotMaterialCandidato_tenantId_materiaPri_idx";

-- RenameIndex
ALTER INDEX "SlotMaterialCand_tenant_slot_idx" RENAME TO "ProductoConfigPasoSlotMaterialCandidato_tenantId_slotMateri_idx";

-- RenameIndex
ALTER INDEX "SlotMaterialCand_tenant_slot_materia_key" RENAME TO "ProductoConfigPasoSlotMaterialCandidato_tenantId_slotMateri_key";

-- RenameIndex
ALTER INDEX "SlotMaterialCandVar_tenant_candidate_idx" RENAME TO "ProductoConfigPasoSlotMaterialCandidatoVariante_tenantId_ca_idx";

-- RenameIndex
ALTER INDEX "SlotMaterialCandVar_tenant_candidate_variant_key" RENAME TO "ProductoConfigPasoSlotMaterialCandidatoVariante_tenantId_ca_key";

-- RenameIndex
ALTER INDEX "SlotMaterialCandVar_tenant_variant_idx" RENAME TO "ProductoConfigPasoSlotMaterialCandidatoVariante_tenantId_va_idx";
