-- Las vigencias son días del calendario comercial, no instantes UTC.
ALTER TABLE "Cupon"
  ALTER COLUMN "vigenciaDesde" TYPE DATE USING "vigenciaDesde"::date,
  ALTER COLUMN "vigenciaHasta" TYPE DATE USING "vigenciaHasta"::date,
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "creadoPorId" UUID,
  ADD COLUMN "creadoPorNombre" TEXT,
  ADD COLUMN "actualizadoPorId" UUID,
  ADD COLUMN "actualizadoPorNombre" TEXT;

ALTER TABLE "Cupon"
  ADD CONSTRAINT "Cupon_tipo_check" CHECK ("tipo" IN ('PORCENTAJE', 'MONTO')),
  ADD CONSTRAINT "Cupon_valor_check" CHECK ("valor" > 0 AND ("tipo" <> 'PORCENTAJE' OR "valor" <= 100)),
  ADD CONSTRAINT "Cupon_alcance_check" CHECK ("alcanceTipo" IN ('ORDEN', 'CATEGORIA', 'SUBCATEGORIA', 'PRODUCTO', 'CLIENTE')),
  ADD CONSTRAINT "Cupon_alcance_ref_check" CHECK (("alcanceTipo" = 'ORDEN' AND "alcanceRef" IS NULL) OR ("alcanceTipo" <> 'ORDEN' AND "alcanceRef" IS NOT NULL)),
  ADD CONSTRAINT "Cupon_uso_check" CHECK ("usoCount" >= 0 AND ("usoMax" IS NULL OR "usoMax" > 0)),
  ADD CONSTRAINT "Cupon_vigencia_check" CHECK ("vigenciaDesde" IS NULL OR "vigenciaHasta" IS NULL OR "vigenciaDesde" <= "vigenciaHasta");

-- Las redenciones pasan a ser un historial de reservas/consumos/liberaciones.
ALTER TABLE "CuponRedencion"
  DROP CONSTRAINT "CuponRedencion_cuponId_fkey",
  ALTER COLUMN "ordenId" DROP NOT NULL,
  ADD COLUMN "estado" TEXT NOT NULL DEFAULT 'CONSUMIDA',
  ADD COLUMN "cotizacionId" UUID,
  ADD COLUMN "actorId" UUID,
  ADD COLUMN "actorNombre" TEXT,
  ADD COLUMN "liberadaEl" TIMESTAMP(3),
  ADD COLUMN "liberadaMotivo" TEXT,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "CuponRedencion"
  ADD CONSTRAINT "CuponRedencion_estado_check" CHECK ("estado" IN ('RESERVADA', 'CONSUMIDA', 'LIBERADA')),
  ADD CONSTRAINT "CuponRedencion_origen_check" CHECK ("cotizacionId" IS NOT NULL OR "ordenId" IS NOT NULL),
  ADD CONSTRAINT "CuponRedencion_monto_check" CHECK ("montoAplicado" >= 0);

ALTER TABLE "CuponRedencion"
  ADD CONSTRAINT "CuponRedencion_cuponId_fkey"
    FOREIGN KEY ("cuponId") REFERENCES "Cupon"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "CuponRedencion_cotizacionId_fkey"
    FOREIGN KEY ("cotizacionId") REFERENCES "Cotizacion"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "CuponRedencion_ordenId_fkey"
    FOREIGN KEY ("ordenId") REFERENCES "OrdenTrabajo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "CuponRedencion_cuponId_cotizacionId_key"
  ON "CuponRedencion"("cuponId", "cotizacionId");
CREATE INDEX "CuponRedencion_tenantId_estado_idx"
  ON "CuponRedencion"("tenantId", "estado");

CREATE TABLE "CuponEvento" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "cuponId" UUID,
  "codigo" TEXT NOT NULL,
  "tipo" TEXT NOT NULL,
  "descripcion" TEXT NOT NULL,
  "actorId" UUID,
  "actorNombre" TEXT NOT NULL,
  "datosJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CuponEvento_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CuponEvento"
  ADD CONSTRAINT "CuponEvento_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "CuponEvento_cuponId_fkey"
    FOREIGN KEY ("cuponId") REFERENCES "Cupon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "CuponEvento_tenantId_cuponId_createdAt_idx"
  ON "CuponEvento"("tenantId", "cuponId", "createdAt");
CREATE INDEX "CuponEvento_tenantId_codigo_createdAt_idx"
  ON "CuponEvento"("tenantId", "codigo", "createdAt");
