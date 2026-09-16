ALTER TABLE "OrdenTrabajoItemPaso" ADD COLUMN "planificadoDesde" TIMESTAMP(3);
-- La baja de una OT/tenant elimina el árbol completo; los servicios validan
-- trabajo iniciado antes de sustituir o retirar una distribución.
ALTER TABLE "OrdenTrabajoItem" DROP CONSTRAINT "OrdenTrabajoItem_loteEntregaId_fkey";
ALTER TABLE "OrdenTrabajoItem" ADD CONSTRAINT "OrdenTrabajoItem_loteEntregaId_fkey" FOREIGN KEY ("loteEntregaId") REFERENCES "LoteProduccionEntrega"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LoteProduccionEntrega" DROP CONSTRAINT "LoteProduccionEntrega_revisionId_tenantId_fkey";
ALTER TABLE "LoteProduccionEntrega" ADD CONSTRAINT "LoteProduccionEntrega_revisionId_tenantId_fkey" FOREIGN KEY ("revisionId", "tenantId") REFERENCES "PlanEntregaRevision"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LoteProduccionEntrega" DROP CONSTRAINT "LoteProduccionEntrega_fuenteId_tenantId_fkey";
ALTER TABLE "LoteProduccionEntrega" ADD CONSTRAINT "LoteProduccionEntrega_fuenteId_tenantId_fkey" FOREIGN KEY ("fuenteId", "tenantId") REFERENCES "FuenteProduccionEntrega"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;
