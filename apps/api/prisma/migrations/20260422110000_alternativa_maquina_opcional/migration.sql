-- Fase D.1 — Alternativas sin máquina.
-- `maquinaId` ahora es opcional para que pasos manuales (diseño, embalaje,
-- gestión externa, etc.) puedan tener alternativas que solo varíen
-- productividad/tiempo (ej. "Diseño básico" vs "Diseño express").

ALTER TABLE "ProcesoOperacionAlternativa"
  ALTER COLUMN "maquinaId" DROP NOT NULL;
