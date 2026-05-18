-- Biblioteca canónica de materias primas instalables por tenant.

CREATE TABLE "MaterialPreset" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key" TEXT NOT NULL,
    "nombreCanonico" TEXT NOT NULL,
    "descripcionCorta" TEXT NOT NULL,
    "familia" "FamiliaMateriaPrima" NOT NULL,
    "subfamilia" "SubfamiliaMateriaPrima" NOT NULL,
    "tipoTecnico" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "iconKind" TEXT NOT NULL,
    "aliasDisponiblesJson" JSONB NOT NULL,
    "usosRecomendadosJson" JSONB NOT NULL,
    "procesosCompatiblesJson" JSONB NOT NULL,
    "advertenciasJson" JSONB NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaterialPreset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MaterialPresetVariante" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "presetId" UUID NOT NULL,
    "skuSugerido" TEXT NOT NULL,
    "nombreVarianteSugerido" TEXT,
    "formato" TEXT NOT NULL,
    "espesor" DECIMAL(10,3),
    "color" TEXT NOT NULL,
    "recomendada" BOOLEAN NOT NULL DEFAULT false,
    "atributosVarianteJson" JSONB NOT NULL,
    "unidadStock" "UnidadMateriaPrima",
    "unidadCompra" "UnidadMateriaPrima",
    "precioReferencia" DECIMAL(14,6),
    "moneda" VARCHAR(3),
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaterialPresetVariante_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "MateriaPrima"
ADD COLUMN "materialPresetId" UUID,
ADD COLUMN "canonicalMaterialKey" TEXT,
ADD COLUMN "canonicalMaterialName" TEXT,
ADD COLUMN "canonicalAliasUsado" TEXT;

ALTER TABLE "MateriaPrimaVariante"
ADD COLUMN "materialPresetVarianteId" UUID;

CREATE UNIQUE INDEX "MaterialPreset_key_key" ON "MaterialPreset"("key");
CREATE INDEX "MaterialPreset_activo_orden_idx" ON "MaterialPreset"("activo", "orden");
CREATE INDEX "MaterialPreset_fam_sub_act_idx" ON "MaterialPreset"("familia", "subfamilia", "activo");

CREATE UNIQUE INDEX "MaterialPresetVariante_preset_sku_key" ON "MaterialPresetVariante"("presetId", "skuSugerido");
CREATE INDEX "MaterialPresetVariante_preset_act_ord_idx" ON "MaterialPresetVariante"("presetId", "activo", "orden");

CREATE INDEX "MateriaPrima_materialPresetId_idx" ON "MateriaPrima"("materialPresetId");
CREATE INDEX "MateriaPrima_tenant_canonicalKey_idx" ON "MateriaPrima"("tenantId", "canonicalMaterialKey");
CREATE INDEX "MateriaPrimaVariante_presetVar_idx" ON "MateriaPrimaVariante"("materialPresetVarianteId");

ALTER TABLE "MaterialPresetVariante"
ADD CONSTRAINT "MaterialPresetVariante_presetId_fkey"
FOREIGN KEY ("presetId") REFERENCES "MaterialPreset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MateriaPrima"
ADD CONSTRAINT "MateriaPrima_materialPresetId_fkey"
FOREIGN KEY ("materialPresetId") REFERENCES "MaterialPreset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MateriaPrimaVariante"
ADD CONSTRAINT "MateriaPrimaVariante_presetVar_fkey"
FOREIGN KEY ("materialPresetVarianteId") REFERENCES "MaterialPresetVariante"("id") ON DELETE SET NULL ON UPDATE CASCADE;
