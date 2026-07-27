-- Egresos F2: retenciones practicadas, cheque propio y adjuntos.
--
-- `RetencionPercepcion.pagoId` cierra la otra mitad del campo `direccion`, que
-- desde el día uno contemplaba 'practicada' ("retenemos al pagar") y no la
-- escribía nadie. Es excluyente con `cobroId`: una retención es sufrida o es
-- practicada, nunca las dos.
--
-- `ArchivoScope.EGRESO` + `Archivo.egresoId`: la factura del proveedor
-- escaneada cuelga del egreso, igual que el arte cuelga del ítem de la orden.
--
-- El cheque PROPIO no necesita columnas nuevas: `Valor` ya soporta
-- origen 'propio' con `proveedorId` y los estados cartera → debitado.
--
-- Ver docs/egresos-y-cuentas-por-pagar-diseno.md

-- AlterEnum
ALTER TYPE "ArchivoScope" ADD VALUE 'EGRESO';

-- AlterTable
ALTER TABLE "Archivo" ADD COLUMN     "egresoId" UUID;

-- AlterTable
ALTER TABLE "RetencionPercepcion" ADD COLUMN     "pagoId" UUID;

-- CreateIndex
CREATE INDEX "Archivo_tenantId_egresoId_idx" ON "Archivo"("tenantId", "egresoId");

-- AddForeignKey
ALTER TABLE "RetencionPercepcion" ADD CONSTRAINT "RetencionPercepcion_pagoId_fkey" FOREIGN KEY ("pagoId") REFERENCES "Pago"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Archivo" ADD CONSTRAINT "Archivo_egresoId_fkey" FOREIGN KEY ("egresoId") REFERENCES "Egreso"("id") ON DELETE CASCADE ON UPDATE CASCADE;

