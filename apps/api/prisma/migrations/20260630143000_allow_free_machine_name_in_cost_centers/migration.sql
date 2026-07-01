ALTER TABLE "CentroCostoRecursoMaquinaPeriodo"
  DROP CONSTRAINT IF EXISTS "CentroCostoRecursoMaquinaPeriodo_maquinaId_fkey";

ALTER TABLE "CentroCostoRecursoMaquinaPeriodo"
  ALTER COLUMN "maquinaId" DROP NOT NULL;

ALTER TABLE "CentroCostoRecursoMaquinaPeriodo"
  ADD CONSTRAINT "CentroCostoRecursoMaquinaPeriodo_maquinaId_fkey"
  FOREIGN KEY ("maquinaId") REFERENCES "Maquina"("id") ON DELETE SET NULL ON UPDATE CASCADE;
