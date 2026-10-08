ALTER TABLE "Cotizacion" ADD COLUMN "versionPresupuesto" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "versionVigente" BOOLEAN NOT NULL DEFAULT true;
DROP INDEX "Cotizacion_tenantId_numero_key";
CREATE UNIQUE INDEX "Cotizacion_tenantId_numero_versionPresupuesto_key"
  ON "Cotizacion"("tenantId", "numero", "versionPresupuesto");
CREATE UNIQUE INDEX "Cotizacion_numero_vigente_key"
  ON "Cotizacion"("tenantId", "numero") WHERE "numero" IS NOT NULL AND "versionVigente";
ALTER TABLE "Cotizacion" ADD CONSTRAINT "Cotizacion_version_positiva" CHECK ("versionPresupuesto" > 0);
