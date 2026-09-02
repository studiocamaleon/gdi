-- El modelo de GateProduccionDocumento ya declaraba esta relación, pero la
-- columna nunca se incorporó a la migración original. Prisma selecciona todos
-- los campos escalares en findMany; por eso cualquier control documental previo
-- a avanzar producción fallaba aun cuando la orden no tuviera gates activos.
ALTER TABLE "GateProduccionDocumento"
  ADD COLUMN "productoRecetaMaterialId" UUID;

ALTER TABLE "GateProduccionDocumento"
  ADD CONSTRAINT "GateProduccionDocumento_productoRecetaMaterialId_fkey"
  FOREIGN KEY ("productoRecetaMaterialId") REFERENCES "ProductoRecetaMaterial"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
