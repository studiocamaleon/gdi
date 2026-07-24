-- Cobro de suscripciones por pasarela (Paddle primero, MercadoPago después).
-- Ver docs/suscripciones-cobro-diseno.md

-- Plan: el monto pasa a ser espejo de Paddle (fuente de verdad: su catálogo).
ALTER TABLE "Plan" ADD COLUMN "moneda" TEXT NOT NULL DEFAULT 'USD';
ALTER TABLE "Plan" ADD COLUMN "paddlePriceId" TEXT;
ALTER TABLE "Plan" ADD COLUMN "paddleProductId" TEXT;
CREATE UNIQUE INDEX "Plan_paddlePriceId_key" ON "Plan"("paddlePriceId");

-- Suscripcion: quién cobra y con qué referencia externa.
ALTER TABLE "Suscripcion" ADD COLUMN "proveedor" TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE "Suscripcion" ADD COLUMN "referenciaExterna" TEXT;
ALTER TABLE "Suscripcion" ADD COLUMN "clienteExternoId" TEXT;
ALTER TABLE "Suscripcion" ADD COLUMN "estadoProveedor" TEXT;
ALTER TABLE "Suscripcion" ADD COLUMN "proximoCobro" TIMESTAMP(3);
CREATE UNIQUE INDEX "Suscripcion_referenciaExterna_key" ON "Suscripcion"("referenciaExterna");

-- Eventos de webhook: idempotencia (eventoId unique) + rastro de auditoría.
CREATE TABLE "EventoCobro" (
    "id" UUID NOT NULL,
    "proveedor" TEXT NOT NULL,
    "eventoId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "payloadJson" JSONB NOT NULL,
    "procesadoEl" TIMESTAMP(3),
    "errorTexto" TEXT,
    "recibidoEl" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EventoCobro_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EventoCobro_eventoId_key" ON "EventoCobro"("eventoId");
CREATE INDEX "EventoCobro_proveedor_tipo_idx" ON "EventoCobro"("proveedor", "tipo");
CREATE INDEX "EventoCobro_recibidoEl_idx" ON "EventoCobro"("recibidoEl");
