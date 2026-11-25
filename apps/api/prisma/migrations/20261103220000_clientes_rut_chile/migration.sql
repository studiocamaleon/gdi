ALTER TABLE "Cliente" ADD COLUMN "rut" VARCHAR(10);

CREATE UNIQUE INDEX "Cliente_tenantId_rut_key" ON "Cliente"("tenantId", "rut");
