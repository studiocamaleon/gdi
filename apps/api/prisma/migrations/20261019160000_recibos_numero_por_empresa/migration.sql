-- El contador ya es por empresa y año; la unicidad debe tener el mismo alcance.
-- Se conserva cada cobro y su número. Primero se instala la nueva protección.
BEGIN;
CREATE UNIQUE INDEX "Cobro_tenantId_numeroRecibo_key" ON "Cobro"("tenantId", "numeroRecibo");
DROP INDEX "Cobro_numeroRecibo_key";
COMMIT;
