-- Índices para los filtros temporales más frecuentes del módulo Reportes.
-- Todos comienzan por tenantId para preservar la selectividad multi-tenant.
CREATE INDEX "Cotizacion_tenantId_fechaEnvio_idx"
  ON "Cotizacion"("tenantId", "fechaEnvio");

CREATE INDEX "OrdenTrabajo_tenantId_estado_fechaEmision_idx"
  ON "OrdenTrabajo"("tenantId", "estado", "fechaEmision");

CREATE INDEX "OrdenTrabajo_tenantId_estado_fechaFinalizada_idx"
  ON "OrdenTrabajo"("tenantId", "estado", "fechaFinalizada");

CREATE INDEX "OrdenTrabajoItemPaso_tenantId_estado_completadoEl_idx"
  ON "OrdenTrabajoItemPaso"("tenantId", "estado", "completadoEl");

CREATE INDEX "Cobro_tenantId_anuladoEl_fecha_idx"
  ON "Cobro"("tenantId", "anuladoEl", "fecha");
