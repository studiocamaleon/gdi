-- E.2 — tercerización declarada del paso (bifurcación del wizard):
-- proveedor/fuente/plazo como defaults; la grilla sigue por producto.
ALTER TABLE "FamiliaPasoDefaults" ADD COLUMN "tercerizado" BOOLEAN;
ALTER TABLE "FamiliaPasoDefaults" ADD COLUMN "proveedorId" UUID;
ALTER TABLE "FamiliaPasoDefaults" ADD COLUMN "fuenteCostoTercerizado" TEXT;
ALTER TABLE "FamiliaPasoDefaults" ADD COLUMN "plazoProveedorDias" INTEGER;

ALTER TABLE "FamiliaPasoDefaults" ADD CONSTRAINT "FamiliaPasoDefaults_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "Proveedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
