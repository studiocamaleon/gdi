-- Identidad fuerte, estados operativos claros y pagos por endoso sin una
-- cuenta ficticia. La clave normalizada evita duplicados por mayúsculas o
-- espacios sin depender de cómo escribió el usuario el banco o el número.
ALTER TABLE "Valor"
  ADD COLUMN "claveInstrumento" VARCHAR(260),
  ADD COLUMN "identificadorBancario" VARCHAR(100),
  ADD COLUMN "endosadoEl" TIMESTAMP(3),
  ADD COLUMN "anuladoEl" TIMESTAMP(3);

UPDATE "Valor"
SET "claveInstrumento" = lower(trim("origen")) || '|' ||
  lower(regexp_replace(trim("banco"), E'\\s+', ' ', 'g')) || '|' ||
  lower(regexp_replace(trim("numero"), E'\\s+', '', 'g'));

-- Antes "cartera" mezclaba un valor recibido con un cheque propio ya emitido.
UPDATE "Valor"
SET "estado" = 'emitido'
WHERE "origen" = 'propio' AND "estado" = 'cartera';

ALTER TABLE "Valor"
  ALTER COLUMN "claveInstrumento" SET NOT NULL;

CREATE UNIQUE INDEX "Valor_tenantId_claveInstrumento_key"
  ON "Valor"("tenantId", "claveInstrumento");

ALTER TABLE "Pago"
  ALTER COLUMN "cuentaOrigenId" DROP NOT NULL;

CREATE UNIQUE INDEX "Pago_valorId_key" ON "Pago"("valorId");
