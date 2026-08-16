-- El listado busca con contains/ILIKE por número, cliente, vendedor e ítem.
-- Sin trigramas esas búsquedas degradan a scans completos al crecer el tenant.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX "OrdenTrabajo_numero_trgm_idx"
  ON "OrdenTrabajo" USING GIN ("numero" gin_trgm_ops);

CREATE INDEX "OrdenTrabajoItem_nombre_trgm_idx"
  ON "OrdenTrabajoItem" USING GIN ("nombre" gin_trgm_ops);

CREATE INDEX "Cliente_nombre_trgm_idx"
  ON "Cliente" USING GIN ("nombre" gin_trgm_ops);

CREATE INDEX "Empleado_nombreCompleto_trgm_idx"
  ON "Empleado" USING GIN ("nombreCompleto" gin_trgm_ops);
