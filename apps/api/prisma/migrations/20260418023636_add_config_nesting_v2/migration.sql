-- Modelo universal (C.2.5) — config de nesting por paso.
-- Cada ProcesoOperacion puede tener su propia config del nesting
-- (distinta forma según el nestingAlgoritmo de la familia).
-- Nullable para no romper pasos existentes.

ALTER TABLE "ProcesoOperacion"
  ADD COLUMN "configNestingV2" JSONB;
