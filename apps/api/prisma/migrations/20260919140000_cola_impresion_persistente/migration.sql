-- Una intención por trabajo/página. Las reservas y confirmaciones se auditan en
-- los eventos de impresión existentes; no se almacenan PDF en la base.
CREATE UNIQUE INDEX "OrdenTrabajoEvento_cola_trabajo_key"
  ON "OrdenTrabajoEvento" ("tenantId", "ordenId", ("datosJson"->>'trabajoId'))
  WHERE tipo = 'cola_impresion';
CREATE INDEX "OrdenTrabajoEvento_cola_maquina_estado_idx"
  ON "OrdenTrabajoEvento" ("tenantId", ("datosJson"->>'maquinaId'), ("datosJson"->>'estado'))
  WHERE tipo = 'cola_impresion';
CREATE INDEX "OrdenTrabajoEvento_impresion_item_pagina_idx"
  ON "OrdenTrabajoEvento" ("tenantId", "ordenId", ("datosJson"->>'itemId'), ("datosJson"->>'pagina'), fecha DESC)
  WHERE tipo = 'impresion_documento';
