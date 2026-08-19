-- Las notas de crédito reducen el saldo del comprobante asociado; no son una
-- cuenta por cobrar independiente. Corrige filas históricas creadas con el
-- mismo saldo inicial que una factura o nota de débito.
UPDATE "Comprobante"
SET "saldoPendiente" = 0
WHERE "tipo" = 'nota_credito'
  AND "saldoPendiente" <> 0;
