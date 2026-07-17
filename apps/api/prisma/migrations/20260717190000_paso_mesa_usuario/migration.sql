-- "Mi mesa de trabajo" persistente (vista Por estación del tablero):
-- el paso reclamado por un usuario queda marcado para todos.
ALTER TABLE "OrdenTrabajoItemPaso" ADD COLUMN "mesaUsuarioId" UUID;

CREATE INDEX "OrdenTrabajoItemPaso_tenantId_mesaUsuarioId_idx" ON "OrdenTrabajoItemPaso"("tenantId", "mesaUsuarioId");

ALTER TABLE "OrdenTrabajoItemPaso" ADD CONSTRAINT "OrdenTrabajoItemPaso_mesaUsuarioId_fkey" FOREIGN KEY ("mesaUsuarioId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
