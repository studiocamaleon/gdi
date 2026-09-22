CREATE TABLE "PlanContratacion" (
  "id" UUID NOT NULL PRIMARY KEY,
  "tenantId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "ofertaId" UUID NOT NULL REFERENCES "PlanOferta"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "ciclo" TEXT NOT NULL CHECK ("ciclo" IN ('mensual', 'anual')),
  "adicionales" INTEGER NOT NULL CHECK ("adicionales" BETWEEN 0 AND 10000),
  "tipo" TEXT NOT NULL CHECK ("tipo" IN ('checkout', 'cambio')),
  "estado" TEXT NOT NULL DEFAULT 'preparada' CHECK ("estado" IN ('preparada', 'enviando', 'checkout', 'verificar', 'aplicada', 'rechazada', 'vencida')),
  "huella" TEXT NOT NULL,
  "revisionContrato" INTEGER NOT NULL,
  "referencia" TEXT,
  "transaccionId" TEXT,
  "revisionRemota" TEXT,
  "revisionJson" JSONB NOT NULL,
  "cobroJson" JSONB NOT NULL,
  "detalle" TEXT,
  "creadaEl" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiraEl" TIMESTAMP(3) NOT NULL,
  "enviadaEl" TIMESTAMP(3),
  "finalizadaEl" TIMESTAMP(3)
);
CREATE UNIQUE INDEX "PlanContratacion_transaccionId_key" ON "PlanContratacion"("transaccionId");
CREATE INDEX "PlanContratacion_tenantId_creadaEl_idx" ON "PlanContratacion"("tenantId", "creadaEl");
CREATE INDEX "PlanContratacion_estado_enviadaEl_idx" ON "PlanContratacion"("estado", "enviadaEl");
-- Una confirmación pendiente puede haber llegado a Paddle aunque se haya perdido
-- la respuesta. Nunca permitir otra operación comercial hasta reconciliarla.
CREATE UNIQUE INDEX "PlanContratacion_unica_pendiente" ON "PlanContratacion"("tenantId")
WHERE "estado" IN ('enviando', 'checkout', 'verificar');
