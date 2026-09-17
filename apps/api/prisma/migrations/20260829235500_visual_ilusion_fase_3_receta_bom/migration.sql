-- Fase 3: receta productiva y BOM versionada.
-- Migración expand-only: todas las referencias nuevas son opcionales para los
-- productos, cotizaciones y OTs existentes.

CREATE TYPE "EstadoProductoRecetaRevision" AS ENUM ('BORRADOR', 'PUBLICADA', 'DEPRECADA');
CREATE TYPE "TipoProductoRecetaComponente" AS ENUM ('FABRICADO');
CREATE TYPE "PoliticaEjecucionRecetaComponente" AS ENUM ('INLINE', 'INDEPENDIENTE');

ALTER TABLE "ProductoConfigPasoSlotMaterial"
  ADD COLUMN "mermaAdicionalPct" DECIMAL(7,3) NOT NULL DEFAULT 0;

ALTER TABLE "CotizacionItem"
  ADD COLUMN "recetaRevisionId" UUID,
  ADD COLUMN "recetaVersion" INTEGER,
  ADD COLUMN "recetaHuella" VARCHAR(64);

ALTER TABLE "OrdenTrabajoItem"
  ADD COLUMN "recetaRevisionId" UUID,
  ADD COLUMN "recetaVersion" INTEGER,
  ADD COLUMN "recetaHuella" VARCHAR(64),
  ADD COLUMN "recetaSnapshotJson" JSONB;

CREATE TABLE "ProductoReceta" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "productoId" UUID NOT NULL,
  "codigo" VARCHAR(80) NOT NULL,
  "nombre" VARCHAR(180) NOT NULL,
  "descripcion" VARCHAR(1500),
  "revisionPublicadaId" UUID,
  "activo" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProductoReceta_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductoRecetaRevision" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "recetaId" UUID NOT NULL,
  "numero" INTEGER NOT NULL,
  "estado" "EstadoProductoRecetaRevision" NOT NULL DEFAULT 'BORRADOR',
  "rutaAlternativaId" UUID NOT NULL,
  "rutaVersion" INTEGER NOT NULL,
  "huellaConfiguracion" VARCHAR(64) NOT NULL,
  "snapshotJson" JSONB NOT NULL,
  "cambios" VARCHAR(1500),
  "creadaPorId" UUID,
  "creadaPorNombre" VARCHAR(200) NOT NULL,
  "publicadaPorId" UUID,
  "publicadaPorNombre" VARCHAR(200),
  "publicadaEl" TIMESTAMP(3),
  "deprecadaPorId" UUID,
  "deprecadaPorNombre" VARCHAR(200),
  "deprecadaEl" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProductoRecetaRevision_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductoRecetaMaterial" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "revisionId" UUID NOT NULL,
  "pasoClave" VARCHAR(120) NOT NULL,
  "pasoNombre" VARCHAR(180) NOT NULL,
  "slotCodigo" VARCHAR(100) NOT NULL,
  "slotNombre" VARCHAR(180),
  "rol" VARCHAR(30),
  "modoSeleccion" VARCHAR(40) NOT NULL,
  "materialVarianteId" UUID,
  "materialSku" VARCHAR(120),
  "materialNombre" VARCHAR(220),
  "unidad" "UnidadMateriaPrima",
  "formula" VARCHAR(60) NOT NULL,
  "cantidadBase" VARCHAR(80),
  "cantidadFactor" DECIMAL(14,6),
  "fuenteMedida" VARCHAR(120),
  "mermaAdicionalPct" DECIMAL(7,3) NOT NULL DEFAULT 0,
  "aplicaMultiCaras" BOOLEAN NOT NULL DEFAULT false,
  "seleccionSnapshotJson" JSONB,
  "orden" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductoRecetaMaterial_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductoRecetaRecurso" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "revisionId" UUID NOT NULL,
  "pasoClave" VARCHAR(120) NOT NULL,
  "pasoNombre" VARCHAR(180) NOT NULL,
  "familiaCodigo" VARCHAR(120) NOT NULL,
  "maquinaId" UUID,
  "maquinaCodigo" VARCHAR(100),
  "maquinaNombre" VARCHAR(180),
  "perfilId" UUID,
  "perfilNombre" VARCHAR(180),
  "centroCostoId" UUID,
  "centroCostoCodigo" VARCHAR(100),
  "centroCostoNombre" VARCHAR(180),
  "dotacionOperarios" INTEGER NOT NULL DEFAULT 1,
  "tercerizado" BOOLEAN NOT NULL DEFAULT false,
  "proveedorId" UUID,
  "proveedorNombre" VARCHAR(220),
  "configuracionSnapshotJson" JSONB,
  "orden" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductoRecetaRecurso_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductoRecetaComponente" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "revisionId" UUID NOT NULL,
  "productoComponenteId" UUID NOT NULL,
  "codigo" VARCHAR(100) NOT NULL,
  "nombre" VARCHAR(180) NOT NULL,
  "tipo" "TipoProductoRecetaComponente" NOT NULL DEFAULT 'FABRICADO',
  "politicaEjecucion" "PoliticaEjecucionRecetaComponente" NOT NULL DEFAULT 'INDEPENDIENTE',
  "formula" VARCHAR(60) NOT NULL DEFAULT 'por_unidad',
  "cantidad" DECIMAL(14,6) NOT NULL DEFAULT 1,
  "unidad" VARCHAR(40) NOT NULL DEFAULT 'unidad',
  "requerido" BOOLEAN NOT NULL DEFAULT true,
  "orden" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductoRecetaComponente_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductoRecetaDocumento" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "revisionId" UUID NOT NULL,
  "pasoClave" VARCHAR(120),
  "codigo" VARCHAR(100) NOT NULL,
  "nombre" VARCHAR(180) NOT NULL,
  "proposito" "PropositoArchivoMaestro" NOT NULL,
  "etapa" "EtapaDesarrolloDocumento" NOT NULL,
  "tipoAprobacion" "TipoAprobacionDocumento",
  "requerido" BOOLEAN NOT NULL DEFAULT true,
  "descripcion" VARCHAR(1000),
  "orden" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductoRecetaDocumento_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductoReceta_productoId_key" ON "ProductoReceta"("productoId");
CREATE UNIQUE INDEX "ProductoReceta_revisionPublicadaId_key" ON "ProductoReceta"("revisionPublicadaId");
CREATE UNIQUE INDEX "ProductoReceta_tenantId_codigo_key" ON "ProductoReceta"("tenantId", "codigo");
CREATE INDEX "ProductoReceta_tenantId_activo_idx" ON "ProductoReceta"("tenantId", "activo");
CREATE UNIQUE INDEX "ProductoRecetaRevision_recetaId_numero_key" ON "ProductoRecetaRevision"("recetaId", "numero");
CREATE INDEX "ProductoRecetaRevision_tenantId_estado_createdAt_idx" ON "ProductoRecetaRevision"("tenantId", "estado", "createdAt");
CREATE INDEX "ProductoRecetaRevision_tenantId_rutaAlternativaId_estado_idx" ON "ProductoRecetaRevision"("tenantId", "rutaAlternativaId", "estado");
CREATE UNIQUE INDEX "ProductoRecetaMaterial_revisionId_pasoClave_slotCodigo_key" ON "ProductoRecetaMaterial"("revisionId", "pasoClave", "slotCodigo");
CREATE INDEX "ProductoRecetaMaterial_tenantId_revisionId_rol_idx" ON "ProductoRecetaMaterial"("tenantId", "revisionId", "rol");
CREATE INDEX "ProductoRecetaMaterial_tenantId_materialVarianteId_idx" ON "ProductoRecetaMaterial"("tenantId", "materialVarianteId");
CREATE UNIQUE INDEX "ProductoRecetaRecurso_revisionId_pasoClave_key" ON "ProductoRecetaRecurso"("revisionId", "pasoClave");
CREATE INDEX "ProductoRecetaRecurso_tenantId_revisionId_idx" ON "ProductoRecetaRecurso"("tenantId", "revisionId");
CREATE INDEX "ProductoRecetaRecurso_tenantId_maquinaId_idx" ON "ProductoRecetaRecurso"("tenantId", "maquinaId");
CREATE UNIQUE INDEX "ProductoRecetaComponente_revisionId_codigo_key" ON "ProductoRecetaComponente"("revisionId", "codigo");
CREATE INDEX "ProductoRecetaComponente_tenantId_productoComponenteId_idx" ON "ProductoRecetaComponente"("tenantId", "productoComponenteId");
CREATE UNIQUE INDEX "ProductoRecetaDocumento_revisionId_codigo_key" ON "ProductoRecetaDocumento"("revisionId", "codigo");
CREATE INDEX "ProductoRecetaDocumento_tenantId_revisionId_requerido_idx" ON "ProductoRecetaDocumento"("tenantId", "revisionId", "requerido");
CREATE INDEX "CotizacionItem_tenantId_recetaRevisionId_idx" ON "CotizacionItem"("tenantId", "recetaRevisionId");
CREATE INDEX "OrdenTrabajoItem_tenantId_recetaRevisionId_idx" ON "OrdenTrabajoItem"("tenantId", "recetaRevisionId");

ALTER TABLE "ProductoReceta" ADD CONSTRAINT "ProductoReceta_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductoReceta" ADD CONSTRAINT "ProductoReceta_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductoRecetaRevision" ADD CONSTRAINT "ProductoRecetaRevision_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductoRecetaRevision" ADD CONSTRAINT "ProductoRecetaRevision_recetaId_fkey" FOREIGN KEY ("recetaId") REFERENCES "ProductoReceta"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductoRecetaRevision" ADD CONSTRAINT "ProductoRecetaRevision_rutaAlternativaId_fkey" FOREIGN KEY ("rutaAlternativaId") REFERENCES "ProductoRutaAlternativa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductoRecetaMaterial" ADD CONSTRAINT "ProductoRecetaMaterial_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductoRecetaMaterial" ADD CONSTRAINT "ProductoRecetaMaterial_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "ProductoRecetaRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductoRecetaRecurso" ADD CONSTRAINT "ProductoRecetaRecurso_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductoRecetaRecurso" ADD CONSTRAINT "ProductoRecetaRecurso_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "ProductoRecetaRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductoRecetaComponente" ADD CONSTRAINT "ProductoRecetaComponente_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductoRecetaComponente" ADD CONSTRAINT "ProductoRecetaComponente_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "ProductoRecetaRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductoRecetaComponente" ADD CONSTRAINT "ProductoRecetaComponente_productoComponenteId_fkey" FOREIGN KEY ("productoComponenteId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductoRecetaDocumento" ADD CONSTRAINT "ProductoRecetaDocumento_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductoRecetaDocumento" ADD CONSTRAINT "ProductoRecetaDocumento_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "ProductoRecetaRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CotizacionItem" ADD CONSTRAINT "CotizacionItem_recetaRevisionId_fkey" FOREIGN KEY ("recetaRevisionId") REFERENCES "ProductoRecetaRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OrdenTrabajoItem" ADD CONSTRAINT "OrdenTrabajoItem_recetaRevisionId_fkey" FOREIGN KEY ("recetaRevisionId") REFERENCES "ProductoRecetaRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProductoReceta" ADD CONSTRAINT "ProductoReceta_revisionPublicadaId_fkey" FOREIGN KEY ("revisionPublicadaId") REFERENCES "ProductoRecetaRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;
