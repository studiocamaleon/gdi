-- CreateTable
CREATE TABLE "PlanEntregaItem" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "ordenItemId" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "revisionActual" INTEGER NOT NULL DEFAULT 0,
    "alternativaElegidaId" VARCHAR(80),
    "elegidaEl" TIMESTAMP(3),
    "elegidaPorId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanEntregaItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanEntregaRevision" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "numero" INTEGER NOT NULL,
    "idempotencyKey" UUID NOT NULL,
    "solicitudHuella" VARCHAR(64) NOT NULL,
    "origenHuella" VARCHAR(64) NOT NULL,
    "contextoHuella" VARCHAR(64),
    "estado" VARCHAR(20) NOT NULL DEFAULT 'SOLICITADA',
    "ejecucionId" UUID,
    "cantidad" INTEGER NOT NULL,
    "cantidadCalculada" INTEGER,
    "solicitadoPorId" UUID NOT NULL,
    "solicitudJson" JSONB NOT NULL,
    "resultadoJson" JSONB,
    "error" TEXT,
    "calculadaEl" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanEntregaRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanEntregaSolicitud" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "revisionId" UUID NOT NULL,
    "clave" VARCHAR(80) NOT NULL,
    "secuencia" INTEGER NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "fechaSolicitada" DATE,

    CONSTRAINT "PlanEntregaSolicitud_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlanEntregaItem_ordenItemId_key" ON "PlanEntregaItem"("ordenItemId");

-- CreateIndex
CREATE INDEX "PlanEntregaItem_tenantId_ordenItemId_idx" ON "PlanEntregaItem"("tenantId", "ordenItemId");

-- CreateIndex
CREATE UNIQUE INDEX "PlanEntregaItem_id_tenantId_key" ON "PlanEntregaItem"("id", "tenantId");

-- CreateIndex
CREATE INDEX "PlanEntregaRevision_estado_createdAt_idx" ON "PlanEntregaRevision"("estado", "createdAt");

-- CreateIndex
CREATE INDEX "PlanEntregaRevision_tenantId_planId_idx" ON "PlanEntregaRevision"("tenantId", "planId");

-- CreateIndex
CREATE UNIQUE INDEX "PlanEntregaRevision_id_tenantId_key" ON "PlanEntregaRevision"("id", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "PlanEntregaRevision_tenantId_idempotencyKey_key" ON "PlanEntregaRevision"("tenantId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "PlanEntregaRevision_planId_numero_key" ON "PlanEntregaRevision"("planId", "numero");

-- CreateIndex
CREATE INDEX "PlanEntregaSolicitud_tenantId_revisionId_idx" ON "PlanEntregaSolicitud"("tenantId", "revisionId");

-- CreateIndex
CREATE UNIQUE INDEX "PlanEntregaSolicitud_revisionId_clave_key" ON "PlanEntregaSolicitud"("revisionId", "clave");

-- CreateIndex
CREATE UNIQUE INDEX "PlanEntregaSolicitud_revisionId_secuencia_key" ON "PlanEntregaSolicitud"("revisionId", "secuencia");

-- AddForeignKey
ALTER TABLE "PlanEntregaItem" ADD CONSTRAINT "PlanEntregaItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanEntregaItem" ADD CONSTRAINT "PlanEntregaItem_ordenItemId_fkey" FOREIGN KEY ("ordenItemId") REFERENCES "OrdenTrabajoItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanEntregaRevision" ADD CONSTRAINT "PlanEntregaRevision_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanEntregaRevision" ADD CONSTRAINT "PlanEntregaRevision_planId_tenantId_fkey" FOREIGN KEY ("planId", "tenantId") REFERENCES "PlanEntregaItem"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanEntregaSolicitud" ADD CONSTRAINT "PlanEntregaSolicitud_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanEntregaSolicitud" ADD CONSTRAINT "PlanEntregaSolicitud_revisionId_tenantId_fkey" FOREIGN KEY ("revisionId", "tenantId") REFERENCES "PlanEntregaRevision"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;


ALTER TABLE "PlanEntregaRevision" ADD CONSTRAINT "PlanEntregaRevision_cantidad_positiva" CHECK ("cantidad" > 0), ADD CONSTRAINT "PlanEntregaRevision_estado_valido" CHECK ("estado" IN ('SOLICITADA', 'CALCULANDO', 'LISTA', 'FALLIDA', 'SUPERADA'));
ALTER TABLE "PlanEntregaSolicitud" ADD CONSTRAINT "PlanEntregaSolicitud_cantidad_positiva" CHECK ("cantidad" > 0), ADD CONSTRAINT "PlanEntregaSolicitud_secuencia_valida" CHECK ("secuencia" >= 0);
