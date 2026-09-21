ALTER TABLE "Suscripcion" ADD COLUMN "actualizadoProveedorEl" TIMESTAMP(3);
ALTER TABLE "EventoCobro" ADD COLUMN "referenciaSuscripcion" TEXT, ADD COLUMN "resultado" TEXT;
UPDATE "EventoCobro" SET "referenciaSuscripcion" = CASE
  WHEN "tipo" LIKE 'subscription.%' THEN "payloadJson"->>'id'
  ELSE COALESCE("payloadJson"->>'subscriptionId', "payloadJson"->>'subscription_id') END
WHERE "proveedor" = 'paddle';
CREATE INDEX "EventoCobro_referenciaSuscripcion_recibidoEl_idx" ON "EventoCobro"("referenciaSuscripcion", "recibidoEl");
CREATE TABLE "SincronizacionPaddle" (
  "id" UUID NOT NULL PRIMARY KEY,
  "tenantId" UUID NOT NULL,
  "suscripcionId" UUID NOT NULL,
  "referencia" TEXT NOT NULL,
  "staffUserId" UUID NOT NULL,
  "motivo" TEXT NOT NULL,
  "estado" TEXT NOT NULL DEFAULT 'en_curso',
  "detalle" TEXT,
  "antesJson" JSONB,
  "despuesJson" JSONB,
  "creadaEl" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finalizadaEl" TIMESTAMP(3),
  CONSTRAINT "SincronizacionPaddle_staffUserId_fkey" FOREIGN KEY ("staffUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "SincronizacionPaddle_tenantId_creadaEl_idx" ON "SincronizacionPaddle"("tenantId", "creadaEl");
CREATE INDEX "SincronizacionPaddle_estado_creadaEl_idx" ON "SincronizacionPaddle"("estado", "creadaEl");
