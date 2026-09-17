ALTER TABLE "OrdenTrabajoItem" ADD COLUMN "contieneLotesEntrega" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "loteEntregaId" UUID;
CREATE TABLE "FuenteProduccionEntrega" (
  "id" UUID NOT NULL, "tenantId" UUID NOT NULL, "revisionId" UUID NOT NULL,
  "cantidad" INTEGER NOT NULL CHECK ("cantidad" > 0), "calculoJson" JSONB NOT NULL,
  "contextoJson" JSONB NOT NULL,
  CONSTRAINT "FuenteProduccionEntrega_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FuenteProduccionEntrega_revisionId_tenantId_fkey" FOREIGN KEY ("revisionId", "tenantId") REFERENCES "PlanEntregaRevision"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "FuenteProduccionEntrega_id_tenantId_key" ON "FuenteProduccionEntrega"("id", "tenantId");
CREATE UNIQUE INDEX "FuenteProduccionEntrega_revisionId_cantidad_key" ON "FuenteProduccionEntrega"("revisionId", "cantidad");
CREATE TABLE "LoteProduccionEntrega" (
  "id" UUID NOT NULL, "tenantId" UUID NOT NULL, "revisionId" UUID NOT NULL,
  "fuenteId" UUID NOT NULL, "productoItemId" UUID NOT NULL, "clave" VARCHAR(80) NOT NULL,
  "secuencia" INTEGER NOT NULL, "cantidad" INTEGER NOT NULL CHECK ("cantidad" > 0),
  "fechaEntrega" DATE NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LoteProduccionEntrega_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LoteProduccionEntrega_revisionId_tenantId_fkey" FOREIGN KEY ("revisionId", "tenantId") REFERENCES "PlanEntregaRevision"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "LoteProduccionEntrega_fuenteId_tenantId_fkey" FOREIGN KEY ("fuenteId", "tenantId") REFERENCES "FuenteProduccionEntrega"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "LoteProduccionEntrega_productoItemId_fkey" FOREIGN KEY ("productoItemId") REFERENCES "OrdenTrabajoItem"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "LoteProduccionEntrega_productoItemId_clave_key" ON "LoteProduccionEntrega"("productoItemId", "clave");
CREATE INDEX "LoteProduccionEntrega_tenantId_productoItemId_idx" ON "LoteProduccionEntrega"("tenantId", "productoItemId");
ALTER TABLE "OrdenTrabajoItem" ADD CONSTRAINT "OrdenTrabajoItem_loteEntregaId_fkey" FOREIGN KEY ("loteEntregaId") REFERENCES "LoteProduccionEntrega"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
