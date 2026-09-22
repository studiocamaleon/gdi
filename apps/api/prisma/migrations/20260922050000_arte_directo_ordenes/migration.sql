-- Arte de una OT sin obligar a crear una campaña. No transforma documentos existentes.
ALTER TABLE "ArchivoMaestro" ALTER COLUMN "proyectoCampanaId" DROP NOT NULL;
ALTER TABLE "ArchivoMaestro" ADD COLUMN "ordenId" UUID;
ALTER TABLE "ArchivoMaestro" ADD CONSTRAINT "ArchivoMaestro_ordenId_fkey"
  FOREIGN KEY ("ordenId") REFERENCES "OrdenTrabajo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ArchivoMaestro" ADD CONSTRAINT "ArchivoMaestro_ambito_exclusivo"
  CHECK (("proyectoCampanaId" IS NOT NULL)::int + ("ordenId" IS NOT NULL)::int = 1);
CREATE UNIQUE INDEX "ArchivoMaestro_tenantId_ordenId_nombre_key" ON "ArchivoMaestro"("tenantId", "ordenId", "nombre");
CREATE INDEX "ArchivoMaestro_tenantId_ordenId_etapa_idx" ON "ArchivoMaestro"("tenantId", "ordenId", "etapa");
ALTER TABLE "GateProduccionDocumento" ALTER COLUMN "proyectoCampanaId" DROP NOT NULL;
