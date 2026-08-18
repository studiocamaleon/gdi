-- Un cheque/eCheq en cartera es un Valor pendiente de depósito, no una
-- CuentaFondos. La cuenta destino se conoce recién al depositarlo.

ALTER TABLE "Cobro"
  ALTER COLUMN "cuentaDestinoId" DROP NOT NULL;

ALTER TABLE "Cobro"
  DROP CONSTRAINT "Cobro_cuentaDestinoId_fkey";

ALTER TABLE "Cobro"
  ADD CONSTRAINT "Cobro_cuentaDestinoId_fkey"
  FOREIGN KEY ("cuentaDestinoId") REFERENCES "CuentaFondos"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Los métodos de cheque tampoco deben sugerir una cuenta antes del depósito.
UPDATE "MetodoPago" metodo
SET "cuentaDestinoId" = NULL,
    "updatedAt" = CURRENT_TIMESTAMP
FROM "CuentaFondos" cuenta
WHERE metodo."cuentaDestinoId" = cuenta."id"
  AND cuenta."tipo" IN ('cartera_valores', 'cartera_valores_legacy');

-- Conservamos el cobro y su Valor, pero dejamos la cuenta sin asignar hasta
-- que Tesorería registre el depósito.
UPDATE "Cobro" cobro
SET "cuentaDestinoId" = NULL,
    "updatedAt" = CURRENT_TIMESTAMP
FROM "CuentaFondos" cuenta
WHERE cobro."cuentaDestinoId" = cuenta."id"
  AND cuenta."tipo" IN ('cartera_valores', 'cartera_valores_legacy');

-- Si una instalación usó indebidamente la pseudo-cuenta para movimientos,
-- pagos o depósitos, no destruimos su auditoría: la archivamos y la API la
-- oculta. Las pseudo-cuentas sin operaciones se eliminan definitivamente.
UPDATE "CuentaFondos" cuenta
SET "tipo" = 'cartera_valores_legacy',
    "activo" = false,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE cuenta."tipo" = 'cartera_valores'
  AND (
    EXISTS (
      SELECT 1 FROM "MovimientoFondos" movimiento
      WHERE movimiento."cuentaId" = cuenta."id"
    )
    OR EXISTS (
      SELECT 1 FROM "Pago" pago
      WHERE pago."cuentaOrigenId" = cuenta."id"
    )
    OR EXISTS (
      SELECT 1 FROM "Valor" valor
      WHERE valor."cuentaDepositoId" = cuenta."id"
    )
  );

DELETE FROM "CuentaFondos" cuenta
WHERE cuenta."tipo" = 'cartera_valores'
  AND NOT EXISTS (
    SELECT 1 FROM "MovimientoFondos" movimiento
    WHERE movimiento."cuentaId" = cuenta."id"
  )
  AND NOT EXISTS (
    SELECT 1 FROM "Pago" pago
    WHERE pago."cuentaOrigenId" = cuenta."id"
  )
  AND NOT EXISTS (
    SELECT 1 FROM "Valor" valor
    WHERE valor."cuentaDepositoId" = cuenta."id"
  );
