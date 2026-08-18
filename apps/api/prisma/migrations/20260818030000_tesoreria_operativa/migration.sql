-- Tesorería operativa: auditoría, idempotencia, cartera de valores y
-- corrección de saldos que habían acreditado el neto antes de retenciones.

ALTER TABLE "CuentaFondos"
  ADD COLUMN "permiteSaldoNegativo" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "MovimientoFondos"
  ADD COLUMN "operacionId" UUID,
  ADD COLUMN "idempotencyKey" VARCHAR(80),
  ADD COLUMN "reversionDeId" UUID,
  ADD COLUMN "referencia" VARCHAR(100),
  ADD COLUMN "notas" VARCHAR(500),
  ADD COLUMN "actorUserId" UUID,
  ADD COLUMN "actorNombre" TEXT;

ALTER TABLE "Cobro"
  ADD COLUMN "anuladoPorId" UUID,
  ADD COLUMN "anuladoPorNombre" TEXT,
  ADD COLUMN "motivoAnulacion" VARCHAR(300),
  ADD COLUMN "idempotencyKey" VARCHAR(80);

ALTER TABLE "Valor"
  ADD COLUMN "depositadoEl" TIMESTAMP(3),
  ADD COLUMN "acreditadoEl" TIMESTAMP(3),
  ADD COLUMN "rechazadoEl" TIMESTAMP(3);

CREATE TABLE "CuentaFondosEvento" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "cuentaId" UUID NOT NULL,
  "tipo" VARCHAR(30) NOT NULL,
  "actorUserId" UUID,
  "actorNombre" TEXT NOT NULL,
  "detalleJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CuentaFondosEvento_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CuentaFondosEvento_cuentaId_fkey"
    FOREIGN KEY ("cuentaId") REFERENCES "CuentaFondos"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "ValorEvento" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "valorId" UUID NOT NULL,
  "tipo" VARCHAR(30) NOT NULL,
  "actorUserId" UUID,
  "actorNombre" TEXT NOT NULL,
  "detalleJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ValorEvento_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ValorEvento_valorId_fkey"
    FOREIGN KEY ("valorId") REFERENCES "Valor"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "MovimientoFondos_tenantId_idempotencyKey_key"
  ON "MovimientoFondos"("tenantId", "idempotencyKey");
CREATE INDEX "MovimientoFondos_tenantId_operacionId_idx"
  ON "MovimientoFondos"("tenantId", "operacionId");
CREATE INDEX "MovimientoFondos_tenantId_estadoConciliacion_fecha_idx"
  ON "MovimientoFondos"("tenantId", "estadoConciliacion", "fecha");
CREATE UNIQUE INDEX "Cobro_tenantId_idempotencyKey_key"
  ON "Cobro"("tenantId", "idempotencyKey");
CREATE INDEX "CuentaFondosEvento_tenantId_cuentaId_createdAt_idx"
  ON "CuentaFondosEvento"("tenantId", "cuentaId", "createdAt");
CREATE INDEX "ValorEvento_tenantId_valorId_createdAt_idx"
  ON "ValorEvento"("tenantId", "valorId", "createdAt");

-- La UI y Cobro.disponibleReal ya descontaban retenciones, pero el libro
-- ingresaba netoAcreditado. Ajustamos cada saldo corrido desde el movimiento
-- afectado, el saldo actual de la cuenta y finalmente el monto del movimiento.
WITH ajustes AS (
  SELECT m."id", m."cuentaId", m."fecha", m."createdAt",
         c."retencionesTotal" AS delta
  FROM "MovimientoFondos" m
  JOIN "Cobro" c ON c."id" = m."cobroId"
  WHERE m."tipo" = 'entrada'
    AND m."origenTipo" = 'cobro'
    AND c."retencionesTotal" > 0
    AND m."monto" = c."netoAcreditado"
)
UPDATE "MovimientoFondos" destino
SET "saldoPosterior" = destino."saldoPosterior" - (
  SELECT COALESCE(SUM(a.delta), 0)
  FROM ajustes a
  WHERE a."cuentaId" = destino."cuentaId"
    AND (a."fecha", a."createdAt", a."id")
        <= (destino."fecha", destino."createdAt", destino."id")
)
WHERE EXISTS (
  SELECT 1 FROM ajustes a WHERE a."cuentaId" = destino."cuentaId"
);

WITH ajustes AS (
  SELECT m."cuentaId", SUM(c."retencionesTotal") AS delta
  FROM "MovimientoFondos" m
  JOIN "Cobro" c ON c."id" = m."cobroId"
  WHERE m."tipo" = 'entrada'
    AND m."origenTipo" = 'cobro'
    AND c."retencionesTotal" > 0
    AND m."monto" = c."netoAcreditado"
  GROUP BY m."cuentaId"
)
UPDATE "CuentaFondos" cuenta
SET "saldo" = cuenta."saldo" - ajustes.delta
FROM ajustes
WHERE cuenta."id" = ajustes."cuentaId";

UPDATE "MovimientoFondos" m
SET "monto" = c."disponibleReal"
FROM "Cobro" c
WHERE c."id" = m."cobroId"
  AND m."tipo" = 'entrada'
  AND m."origenTipo" = 'cobro'
  AND c."retencionesTotal" > 0
  AND m."monto" = c."netoAcreditado";

-- El valor físico recibido representa lo efectivamente entregado por el
-- cliente; el bruto sigue saldando comercialmente la factura.
UPDATE "Valor" v
SET "importe" = c."disponibleReal"
FROM "Cobro" c
WHERE c."id" = v."cobroId"
  AND v."origen" = 'tercero'
  AND v."estado" IN ('cartera', 'depositado');
