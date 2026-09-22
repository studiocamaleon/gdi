-- Defaults compatibles: las OT anteriores mantienen su circuito operativo.
ALTER TABLE "OrdenTrabajo"
  ADD COLUMN "produccionControlada" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "cobrosHabilitadosEmision" BOOLEAN NOT NULL DEFAULT true;
