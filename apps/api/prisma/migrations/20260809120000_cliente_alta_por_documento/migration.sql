-- Alta de cliente escaneando el DNI en el mostrador.
--
-- El email deja de ser obligatorio: del documento salen nombre y número, y
-- nadie le pide el email a alguien que está esperando en el mostrador. Los
-- clientes existentes no se tocan (ya lo tienen).
ALTER TABLE "Cliente" ALTER COLUMN "emailPrincipal" DROP NOT NULL;

-- Los vacíos que hubiera pasan a null: "" y "sin email" son lo mismo, y
-- dejarlo en "" obliga a chequear las dos cosas en cada lectura.
UPDATE "Cliente" SET "emailPrincipal" = NULL WHERE trim("emailPrincipal") = '';

-- DNI del documento. Separado del CUIT a propósito: ARCA los declara con
-- tipos distintos (96 = DNI, 80 = CUIT) y un CUIL derivado no siempre es el
-- CUIT real de la persona.
ALTER TABLE "Cliente" ADD COLUMN "documentoNumero" VARCHAR(9);
ALTER TABLE "Cliente" ADD COLUMN "origenAlta" TEXT;

-- Buscar por documento tiene que ser exacto y rápido: el operador escanea y
-- espera. Parcial (sólo los que tienen documento) para no indexar millones
-- de nulls.
CREATE INDEX "Cliente_tenantId_documentoNumero_idx"
  ON "Cliente"("tenantId", "documentoNumero")
  WHERE "documentoNumero" IS NOT NULL;
