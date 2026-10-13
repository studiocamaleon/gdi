-- CreateTable
CREATE TABLE "CentroCopiadoTarifario" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "nombre" VARCHAR(120) NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "ultimoNumero" INTEGER NOT NULL DEFAULT 0,
    "contenido" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CentroCopiadoTarifario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CentroCopiadoTarifarioVersion" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "tarifarioId" UUID NOT NULL,
    "numero" INTEGER NOT NULL,
    "revisionBorrador" INTEGER NOT NULL,
    "nombre" VARCHAR(120) NOT NULL,
    "contenido" JSONB NOT NULL,
    "tipoVigencia" VARCHAR(20) NOT NULL,
    "vigenteDesde" TIMESTAMPTZ(3) NOT NULL,
    "publicadoPorId" UUID NOT NULL,
    "publicadoEl" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CentroCopiadoTarifarioVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CentroCopiadoTarifario_tenantId_createdAt_idx" ON "CentroCopiadoTarifario"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CentroCopiadoTarifario_id_tenantId_key" ON "CentroCopiadoTarifario"("id", "tenantId");

-- CreateIndex
CREATE INDEX "CentroCopiadoTarifarioVersion_tenantId_tarifarioId_vigenteD_idx" ON "CentroCopiadoTarifarioVersion"("tenantId", "tarifarioId", "vigenteDesde");

-- CreateIndex
CREATE UNIQUE INDEX "CentroCopiadoTarifarioVersion_tarifarioId_revisionBorrador_key" ON "CentroCopiadoTarifarioVersion"("tarifarioId", "revisionBorrador");

-- CreateIndex
CREATE UNIQUE INDEX "CentroCopiadoTarifarioVersion_tarifarioId_numero_key" ON "CentroCopiadoTarifarioVersion"("tarifarioId", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "CentroCopiadoTarifarioVersion_tarifarioId_vigenteDesde_key" ON "CentroCopiadoTarifarioVersion"("tarifarioId", "vigenteDesde");

-- AddForeignKey
ALTER TABLE "CentroCopiadoTarifario" ADD CONSTRAINT "CentroCopiadoTarifario_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CentroCopiadoTarifarioVersion" ADD CONSTRAINT "CentroCopiadoTarifarioVersion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CentroCopiadoTarifarioVersion" ADD CONSTRAINT "CentroCopiadoTarifarioVersion_tarifarioId_tenantId_fkey" FOREIGN KEY ("tarifarioId", "tenantId") REFERENCES "CentroCopiadoTarifario"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CentroCopiadoTarifario" ADD CONSTRAINT "copiado_tarifario_revision_positiva"
  CHECK ("revision" > 0 AND "ultimoNumero" >= 0);
ALTER TABLE "CentroCopiadoTarifarioVersion" ADD CONSTRAINT "copiado_version_valida"
  CHECK ("numero" > 0 AND "revisionBorrador" > 0 AND "tipoVigencia" IN ('INMEDIATA', 'PROGRAMADA'));

-- El historial comercial no se reescribe ni elimina individualmente.
-- Se conserva la eliminación integral del tenant que ya usa el sistema.
CREATE FUNCTION "copiado_proteger_version_publicada"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' AND NOT EXISTS (SELECT 1 FROM "Tenant" WHERE "id" = OLD."tenantId") THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'Las versiones publicadas de Centro de copiado son inmutables';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "copiado_version_inmutable"
  BEFORE UPDATE OR DELETE ON "CentroCopiadoTarifarioVersion"
  FOR EACH ROW EXECUTE FUNCTION "copiado_proteger_version_publicada"();
