-- Enterprise no tiene precio de lista: cero evita inventar MRR. La interfaz
-- lo presenta como "A medida" por `precioAConsultar`, nunca como USD 0.
UPDATE "Plan"
SET "precioMensual" = 0
WHERE "codigo" = 'diamante' AND "precioAConsultar" = true;
