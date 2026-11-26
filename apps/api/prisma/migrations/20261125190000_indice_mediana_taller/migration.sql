-- Medianas históricas del taller al cotizar y emitir una OT.
CREATE INDEX CONCURRENTLY "OrdenTrabajoItemPaso_mediana_taller_idx"
ON "OrdenTrabajoItemPaso" ("tenantId", "familiaCodigo", "tiempoRealMin")
WHERE "estado" = 'hecho'
  AND "tiempoRealMin" IS NOT NULL
  AND "tiempoFuente" IN ('medido', 'medido_lote')
  AND "nestingLoteRol" IS DISTINCT FROM 'PARTICIPANTE';
