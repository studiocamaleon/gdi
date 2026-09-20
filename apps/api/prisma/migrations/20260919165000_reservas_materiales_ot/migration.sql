-- AlterTable
ALTER TABLE "OrdenTrabajo" ADD COLUMN     "materialesControlados" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "materialesRevision" VARCHAR(64);

-- CreateTable
CREATE TABLE "PoliticaReservasMaterial" (
    "tenantId" UUID NOT NULL,
    "habilitada" BOOLEAN NOT NULL DEFAULT false,
    "incluirConsumibles" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PoliticaReservasMaterial_pkey" PRIMARY KEY ("tenantId")
);

-- CreateTable
CREATE TABLE "NecesidadMaterialOt" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "ordenId" UUID NOT NULL,
    "varianteId" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "unidad" VARCHAR(32) NOT NULL,
    "revision" VARCHAR(64) NOT NULL,
    "fuente" VARCHAR(16) NOT NULL DEFAULT 'SNAPSHOT',
    "estado" VARCHAR(16) NOT NULL DEFAULT 'ACTIVA',
    "cantidad" DECIMAL(20,8) NOT NULL,
    "consumida" DECIMAL(20,8) NOT NULL DEFAULT 0,
    "motivoRevision" TEXT,
    "origenesJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NecesidadMaterialOt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReservaMaterialOt" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "necesidadId" UUID NOT NULL,
    "ubicacionId" UUID NOT NULL,
    "cantidad" DECIMAL(20,8) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReservaMaterialOt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsumoMaterialOt" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "necesidadId" UUID NOT NULL,
    "reservaId" UUID NOT NULL,
    "movimientoId" UUID NOT NULL,
    "cantidad" DECIMAL(20,8) NOT NULL,
    "costoUnitario" DECIMAL(14,6) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsumoMaterialOt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperacionReservasMaterial" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "ordenId" UUID NOT NULL,
    "clave" UUID NOT NULL,
    "accion" VARCHAR(32) NOT NULL,
    "huella" VARCHAR(64) NOT NULL,
    "actorUsuarioId" UUID,
    "actorNombre" TEXT NOT NULL,
    "detalleJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OperacionReservasMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NecesidadMaterialOt_tenantId_varianteId_estado_idx" ON "NecesidadMaterialOt"("tenantId", "varianteId", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "NecesidadMaterialOt_tenantId_id_key" ON "NecesidadMaterialOt"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "NecesidadMaterialOt_tenantId_ordenId_varianteId_key" ON "NecesidadMaterialOt"("tenantId", "ordenId", "varianteId");

-- CreateIndex
CREATE INDEX "ReservaMaterialOt_tenantId_ubicacionId_idx" ON "ReservaMaterialOt"("tenantId", "ubicacionId");

-- CreateIndex
CREATE UNIQUE INDEX "ReservaMaterialOt_tenantId_id_key" ON "ReservaMaterialOt"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ReservaMaterialOt_tenantId_necesidadId_ubicacionId_key" ON "ReservaMaterialOt"("tenantId", "necesidadId", "ubicacionId");

-- CreateIndex
CREATE INDEX "ConsumoMaterialOt_tenantId_necesidadId_idx" ON "ConsumoMaterialOt"("tenantId", "necesidadId");

-- CreateIndex
CREATE UNIQUE INDEX "ConsumoMaterialOt_tenantId_movimientoId_key" ON "ConsumoMaterialOt"("tenantId", "movimientoId");

-- CreateIndex
CREATE INDEX "OperacionReservasMaterial_tenantId_ordenId_createdAt_idx" ON "OperacionReservasMaterial"("tenantId", "ordenId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "OperacionReservasMaterial_tenantId_clave_key" ON "OperacionReservasMaterial"("tenantId", "clave");

-- CreateIndex
CREATE UNIQUE INDEX "MateriaPrimaVariante_tenantId_id_key" ON "MateriaPrimaVariante"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "AlmacenMateriaPrimaUbicacion_tenantId_id_key" ON "AlmacenMateriaPrimaUbicacion"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "MovimientoStockMateriaPrima_tenantId_id_key" ON "MovimientoStockMateriaPrima"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "OrdenTrabajo_tenantId_id_key" ON "OrdenTrabajo"("tenantId", "id");

-- AddForeignKey
ALTER TABLE "PoliticaReservasMaterial" ADD CONSTRAINT "PoliticaReservasMaterial_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NecesidadMaterialOt" ADD CONSTRAINT "NecesidadMaterialOt_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NecesidadMaterialOt" ADD CONSTRAINT "NecesidadMaterialOt_tenantId_ordenId_fkey" FOREIGN KEY ("tenantId", "ordenId") REFERENCES "OrdenTrabajo"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NecesidadMaterialOt" ADD CONSTRAINT "NecesidadMaterialOt_tenantId_varianteId_fkey" FOREIGN KEY ("tenantId", "varianteId") REFERENCES "MateriaPrimaVariante"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservaMaterialOt" ADD CONSTRAINT "ReservaMaterialOt_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservaMaterialOt" ADD CONSTRAINT "ReservaMaterialOt_tenantId_necesidadId_fkey" FOREIGN KEY ("tenantId", "necesidadId") REFERENCES "NecesidadMaterialOt"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservaMaterialOt" ADD CONSTRAINT "ReservaMaterialOt_tenantId_ubicacionId_fkey" FOREIGN KEY ("tenantId", "ubicacionId") REFERENCES "AlmacenMateriaPrimaUbicacion"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumoMaterialOt" ADD CONSTRAINT "ConsumoMaterialOt_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumoMaterialOt" ADD CONSTRAINT "ConsumoMaterialOt_tenantId_necesidadId_fkey" FOREIGN KEY ("tenantId", "necesidadId") REFERENCES "NecesidadMaterialOt"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumoMaterialOt" ADD CONSTRAINT "ConsumoMaterialOt_tenantId_reservaId_fkey" FOREIGN KEY ("tenantId", "reservaId") REFERENCES "ReservaMaterialOt"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumoMaterialOt" ADD CONSTRAINT "ConsumoMaterialOt_tenantId_movimientoId_fkey" FOREIGN KEY ("tenantId", "movimientoId") REFERENCES "MovimientoStockMateriaPrima"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperacionReservasMaterial" ADD CONSTRAINT "OperacionReservasMaterial_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperacionReservasMaterial" ADD CONSTRAINT "OperacionReservasMaterial_tenantId_ordenId_fkey" FOREIGN KEY ("tenantId", "ordenId") REFERENCES "OrdenTrabajo"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Cantidades operativas no negativas; consumos no superiores a la necesidad confirmada.
ALTER TABLE "NecesidadMaterialOt" ADD CONSTRAINT "NecesidadMaterialOt_cantidades_check" CHECK ("cantidad" >= 0 AND "consumida" >= 0 AND "consumida" <= "cantidad");
ALTER TABLE "ReservaMaterialOt" ADD CONSTRAINT "ReservaMaterialOt_cantidad_check" CHECK ("cantidad" >= 0);
ALTER TABLE "ConsumoMaterialOt" ADD CONSTRAINT "ConsumoMaterialOt_cantidad_check" CHECK ("cantidad" > 0 AND "costoUnitario" >= 0);
