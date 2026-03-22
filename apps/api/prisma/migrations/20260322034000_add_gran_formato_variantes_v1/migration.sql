CREATE TABLE "GranFormatoVariante" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "productoServicioId" UUID NOT NULL,
  "nombre" TEXT NOT NULL,
  "maquinaId" UUID NOT NULL,
  "perfilOperativoId" UUID NOT NULL,
  "materiaPrimaVarianteId" UUID NOT NULL,
  "esDefault" BOOLEAN NOT NULL DEFAULT false,
  "permiteOverrideEnCotizacion" BOOLEAN NOT NULL DEFAULT true,
  "activo" BOOLEAN NOT NULL DEFAULT true,
  "observaciones" TEXT,
  "detalleJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "GranFormatoVariante_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GranFormatoVariante_tenantId_productoServicioId_nombre_key"
  ON "GranFormatoVariante"("tenantId", "productoServicioId", "nombre");

CREATE INDEX "GranFormatoVariante_tenantId_productoServicioId_activo_idx"
  ON "GranFormatoVariante"("tenantId", "productoServicioId", "activo");

CREATE INDEX "GranFormatoVariante_tenantId_maquinaId_activo_idx"
  ON "GranFormatoVariante"("tenantId", "maquinaId", "activo");

CREATE INDEX "GranFormatoVariante_tenantId_perfilOperativoId_activo_idx"
  ON "GranFormatoVariante"("tenantId", "perfilOperativoId", "activo");

CREATE INDEX "GranFormatoVariante_tenantId_materiaPrimaVarianteId_activo_idx"
  ON "GranFormatoVariante"("tenantId", "materiaPrimaVarianteId", "activo");

ALTER TABLE "GranFormatoVariante"
  ADD CONSTRAINT "GranFormatoVariante_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "GranFormatoVariante_productoServicioId_fkey"
    FOREIGN KEY ("productoServicioId") REFERENCES "ProductoServicio"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "GranFormatoVariante_maquinaId_fkey"
    FOREIGN KEY ("maquinaId") REFERENCES "Maquina"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "GranFormatoVariante_perfilOperativoId_fkey"
    FOREIGN KEY ("perfilOperativoId") REFERENCES "MaquinaPerfilOperativo"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "GranFormatoVariante_materiaPrimaVarianteId_fkey"
    FOREIGN KEY ("materiaPrimaVarianteId") REFERENCES "MateriaPrimaVariante"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
