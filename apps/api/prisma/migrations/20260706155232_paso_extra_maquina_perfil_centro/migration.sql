-- AlterTable
ALTER TABLE "ProductoPasoExtra" ADD COLUMN     "centroCostoId" UUID;

-- AddForeignKey
ALTER TABLE "ProductoPasoExtra" ADD CONSTRAINT "ProductoPasoExtra_maquinaM1Id_fkey" FOREIGN KEY ("maquinaM1Id") REFERENCES "Maquina"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductoPasoExtra" ADD CONSTRAINT "ProductoPasoExtra_perfilM1Id_fkey" FOREIGN KEY ("perfilM1Id") REFERENCES "MaquinaPerfilOperativo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductoPasoExtra" ADD CONSTRAINT "ProductoPasoExtra_centroCostoId_fkey" FOREIGN KEY ("centroCostoId") REFERENCES "CentroCosto"("id") ON DELETE SET NULL ON UPDATE CASCADE;
