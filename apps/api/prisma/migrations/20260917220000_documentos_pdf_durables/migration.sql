-- AlterTable
ALTER TABLE "Archivo" ADD COLUMN     "documentoPdfId" UUID;

-- CreateTable
CREATE TABLE "DocumentoPdf" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "cotizacionId" UUID NOT NULL,
    "revision" INTEGER NOT NULL,
    "plantillaVersion" TEXT NOT NULL,
    "datosHash" TEXT NOT NULL,
    "datosJson" JSONB NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "ronda" INTEGER NOT NULL DEFAULT 0,
    "proximoIntentoEl" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "encoladoEl" TIMESTAMP(3),
    "leaseToken" UUID,
    "leaseHasta" TIMESTAMP(3),
    "errorCodigo" TEXT,
    "errorMensaje" TEXT,
    "contenidoHash" TEXT,
    "generadoEl" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentoPdf_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocumentoPdf_estado_proximoIntentoEl_encoladoEl_idx" ON "DocumentoPdf"("estado", "proximoIntentoEl", "encoladoEl");

-- CreateIndex
CREATE INDEX "DocumentoPdf_estado_leaseHasta_idx" ON "DocumentoPdf"("estado", "leaseHasta");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentoPdf_tenantId_cotizacionId_revision_key" ON "DocumentoPdf"("tenantId", "cotizacionId", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "Archivo_documentoPdfId_key" ON "Archivo"("documentoPdfId");

-- AddForeignKey
ALTER TABLE "DocumentoPdf" ADD CONSTRAINT "DocumentoPdf_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentoPdf" ADD CONSTRAINT "DocumentoPdf_cotizacionId_fkey" FOREIGN KEY ("cotizacionId") REFERENCES "Cotizacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Archivo" ADD CONSTRAINT "Archivo_documentoPdfId_fkey" FOREIGN KEY ("documentoPdfId") REFERENCES "DocumentoPdf"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Los documentos versionados tienen su unicidad en documentoPdfId. El índice
-- histórico se conserva para todos los demás generadores, sin tocar sus filas.
DROP INDEX "Archivo_generado_vigente_unico";
CREATE UNIQUE INDEX "Archivo_generado_vigente_unico" ON "Archivo" (
  "scope", COALESCE("cotizacionId", "comprobanteId", "ordenId", "ordenItemId",
                   "clienteId", "cobroId", "productoId", "proveedorId")
) WHERE "generado" AND "estado" = 'LISTO' AND "documentoPdfId" IS NULL;

ALTER TABLE "DocumentoPdf" ADD CONSTRAINT "DocumentoPdf_estado_valido"
  CHECK ("estado" IN ('PENDIENTE', 'PROCESANDO', 'LISTO', 'FALLIDO'));
ALTER TABLE "DocumentoPdf" ADD CONSTRAINT "DocumentoPdf_revision_valida"
  CHECK ("revision" IN (1, 2));

CREATE FUNCTION documento_pdf_snapshot_inmutable() RETURNS trigger AS $$
BEGIN
  IF NEW."tenantId" IS DISTINCT FROM OLD."tenantId"
     OR NEW."cotizacionId" IS DISTINCT FROM OLD."cotizacionId"
     OR NEW.revision IS DISTINCT FROM OLD.revision
     OR NEW."datosHash" IS DISTINCT FROM OLD."datosHash"
     OR NEW."plantillaVersion" IS DISTINCT FROM OLD."plantillaVersion"
     OR NEW."datosJson" IS DISTINCT FROM OLD."datosJson" THEN
    RAISE EXCEPTION 'El snapshot de un documento PDF es inmutable';
  END IF;
  IF OLD.estado = 'LISTO' AND (NEW.estado <> 'LISTO' OR NEW."contenidoHash" IS DISTINCT FROM OLD."contenidoHash") THEN
    RAISE EXCEPTION 'Un PDF emitido no puede reemplazarse';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "DocumentoPdf_snapshot_inmutable"
  BEFORE UPDATE ON "DocumentoPdf" FOR EACH ROW EXECUTE FUNCTION documento_pdf_snapshot_inmutable();
