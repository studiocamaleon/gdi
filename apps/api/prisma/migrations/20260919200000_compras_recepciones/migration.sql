-- AlterTable
ALTER TABLE "Proveedor" ADD COLUMN     "reposicionDias" INTEGER,
ADD COLUMN     "reposicionTipo" VARCHAR(16) NOT NULL DEFAULT 'CORRIDOS';

-- CreateTable
CREATE TABLE "OfertaCompra" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "proveedorId" UUID NOT NULL,
    "varianteId" UUID NOT NULL,
    "codigoProveedor" VARCHAR(120),
    "unidadCompra" "UnidadMateriaPrima" NOT NULL,
    "unidadStock" "UnidadMateriaPrima" NOT NULL,
    "factorStock" DECIMAL(20,8) NOT NULL,
    "precio" DECIMAL(14,6),
    "moneda" VARCHAR(3) NOT NULL,
    "minimo" DECIMAL(20,8) NOT NULL DEFAULT 0,
    "multiplo" DECIMAL(20,8),
    "reposicionDias" INTEGER,
    "reposicionTipo" VARCHAR(16),
    "vigenteHasta" DATE,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OfertaCompra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrdenCompra" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "numero" INTEGER NOT NULL,
    "proveedorId" UUID NOT NULL,
    "proveedorNombre" TEXT NOT NULL,
    "ubicacionId" UUID NOT NULL,
    "estado" VARCHAR(24) NOT NULL DEFAULT 'BORRADOR',
    "version" INTEGER NOT NULL DEFAULT 1,
    "fechaPedido" DATE NOT NULL,
    "moneda" VARCHAR(3) NOT NULL,
    "monedaStock" VARCHAR(3) NOT NULL,
    "tipoCambio" DECIMAL(20,8) NOT NULL,
    "notas" VARCHAR(1000),
    "motivoCierre" VARCHAR(500),
    "creadoPor" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrdenCompra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LineaOrdenCompra" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "ordenId" UUID NOT NULL,
    "varianteId" UUID NOT NULL,
    "posicion" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "unidadCompra" "UnidadMateriaPrima" NOT NULL,
    "unidadStock" "UnidadMateriaPrima" NOT NULL,
    "factorStock" DECIMAL(20,8) NOT NULL,
    "cantidad" DECIMAL(20,8) NOT NULL,
    "recibida" DECIMAL(20,8) NOT NULL DEFAULT 0,
    "precio" DECIMAL(14,6) NOT NULL,
    "fechaEstimada" DATE,
    "fechaConfirmada" DATE,
    "plazoDias" INTEGER,
    "plazoTipo" VARCHAR(16),
    "ofertaSnapshot" JSONB NOT NULL,

    CONSTRAINT "LineaOrdenCompra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoberturaCompra" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "lineaId" UUID NOT NULL,
    "necesidadId" UUID NOT NULL,
    "revision" VARCHAR(64) NOT NULL,
    "cantidad" DECIMAL(20,8) NOT NULL,
    "recibida" DECIMAL(20,8) NOT NULL DEFAULT 0,

    CONSTRAINT "CoberturaCompra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecepcionCompra" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "ordenId" UUID NOT NULL,
    "ubicacionId" UUID NOT NULL,
    "referencia" VARCHAR(160),
    "notas" VARCHAR(500),
    "actor" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecepcionCompra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DetalleRecepcionCompra" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "recepcionId" UUID NOT NULL,
    "lineaId" UUID NOT NULL,
    "movimientoId" UUID NOT NULL,
    "cantidadCompra" DECIMAL(20,8) NOT NULL,
    "cantidadStock" DECIMAL(20,8) NOT NULL,
    "costoStock" DECIMAL(14,6) NOT NULL,
    "reservasJson" JSONB NOT NULL,

    CONSTRAINT "DetalleRecepcionCompra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperacionCompra" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "clave" UUID NOT NULL,
    "huella" VARCHAR(64) NOT NULL,
    "ordenId" UUID,
    "accion" VARCHAR(32) NOT NULL,
    "actor" TEXT NOT NULL,
    "resultado" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OperacionCompra_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OfertaCompra_tenantId_varianteId_activo_idx" ON "OfertaCompra"("tenantId", "varianteId", "activo");

-- CreateIndex
CREATE UNIQUE INDEX "OfertaCompra_tenantId_proveedorId_varianteId_key" ON "OfertaCompra"("tenantId", "proveedorId", "varianteId");

-- CreateIndex
CREATE INDEX "OrdenCompra_tenantId_estado_createdAt_idx" ON "OrdenCompra"("tenantId", "estado", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "OrdenCompra_tenantId_id_key" ON "OrdenCompra"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "OrdenCompra_tenantId_numero_key" ON "OrdenCompra"("tenantId", "numero");

-- CreateIndex
CREATE INDEX "LineaOrdenCompra_tenantId_varianteId_idx" ON "LineaOrdenCompra"("tenantId", "varianteId");

-- CreateIndex
CREATE UNIQUE INDEX "LineaOrdenCompra_tenantId_id_key" ON "LineaOrdenCompra"("tenantId", "id");

-- CreateIndex
CREATE INDEX "CoberturaCompra_tenantId_necesidadId_idx" ON "CoberturaCompra"("tenantId", "necesidadId");

-- CreateIndex
CREATE UNIQUE INDEX "CoberturaCompra_tenantId_lineaId_necesidadId_key" ON "CoberturaCompra"("tenantId", "lineaId", "necesidadId");

-- CreateIndex
CREATE INDEX "RecepcionCompra_tenantId_createdAt_idx" ON "RecepcionCompra"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RecepcionCompra_tenantId_id_key" ON "RecepcionCompra"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "DetalleRecepcionCompra_tenantId_movimientoId_key" ON "DetalleRecepcionCompra"("tenantId", "movimientoId");

-- CreateIndex
CREATE INDEX "OperacionCompra_tenantId_ordenId_createdAt_idx" ON "OperacionCompra"("tenantId", "ordenId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "OperacionCompra_tenantId_clave_key" ON "OperacionCompra"("tenantId", "clave");

-- CreateIndex
CREATE UNIQUE INDEX "Proveedor_tenantId_id_key" ON "Proveedor"("tenantId", "id");

-- AddForeignKey
ALTER TABLE "OfertaCompra" ADD CONSTRAINT "OfertaCompra_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfertaCompra" ADD CONSTRAINT "OfertaCompra_tenantId_proveedorId_fkey" FOREIGN KEY ("tenantId", "proveedorId") REFERENCES "Proveedor"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfertaCompra" ADD CONSTRAINT "OfertaCompra_tenantId_varianteId_fkey" FOREIGN KEY ("tenantId", "varianteId") REFERENCES "MateriaPrimaVariante"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenCompra" ADD CONSTRAINT "OrdenCompra_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenCompra" ADD CONSTRAINT "OrdenCompra_tenantId_proveedorId_fkey" FOREIGN KEY ("tenantId", "proveedorId") REFERENCES "Proveedor"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenCompra" ADD CONSTRAINT "OrdenCompra_tenantId_ubicacionId_fkey" FOREIGN KEY ("tenantId", "ubicacionId") REFERENCES "AlmacenMateriaPrimaUbicacion"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LineaOrdenCompra" ADD CONSTRAINT "LineaOrdenCompra_tenantId_ordenId_fkey" FOREIGN KEY ("tenantId", "ordenId") REFERENCES "OrdenCompra"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LineaOrdenCompra" ADD CONSTRAINT "LineaOrdenCompra_tenantId_varianteId_fkey" FOREIGN KEY ("tenantId", "varianteId") REFERENCES "MateriaPrimaVariante"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoberturaCompra" ADD CONSTRAINT "CoberturaCompra_tenantId_lineaId_fkey" FOREIGN KEY ("tenantId", "lineaId") REFERENCES "LineaOrdenCompra"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoberturaCompra" ADD CONSTRAINT "CoberturaCompra_tenantId_necesidadId_fkey" FOREIGN KEY ("tenantId", "necesidadId") REFERENCES "NecesidadMaterialOt"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecepcionCompra" ADD CONSTRAINT "RecepcionCompra_tenantId_ordenId_fkey" FOREIGN KEY ("tenantId", "ordenId") REFERENCES "OrdenCompra"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecepcionCompra" ADD CONSTRAINT "RecepcionCompra_tenantId_ubicacionId_fkey" FOREIGN KEY ("tenantId", "ubicacionId") REFERENCES "AlmacenMateriaPrimaUbicacion"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DetalleRecepcionCompra" ADD CONSTRAINT "DetalleRecepcionCompra_tenantId_recepcionId_fkey" FOREIGN KEY ("tenantId", "recepcionId") REFERENCES "RecepcionCompra"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DetalleRecepcionCompra" ADD CONSTRAINT "DetalleRecepcionCompra_tenantId_lineaId_fkey" FOREIGN KEY ("tenantId", "lineaId") REFERENCES "LineaOrdenCompra"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DetalleRecepcionCompra" ADD CONSTRAINT "DetalleRecepcionCompra_tenantId_movimientoId_fkey" FOREIGN KEY ("tenantId", "movimientoId") REFERENCES "MovimientoStockMateriaPrima"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperacionCompra" ADD CONSTRAINT "OperacionCompra_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;


ALTER TABLE "Proveedor" ADD CONSTRAINT "Proveedor_reposicion_check" CHECK (("reposicionDias" IS NULL OR "reposicionDias" BETWEEN 0 AND 3650) AND "reposicionTipo" IN ('CORRIDOS','HABILES'));
ALTER TABLE "OfertaCompra" ADD CONSTRAINT "OfertaCompra_cantidades_check" CHECK ("factorStock">0 AND "minimo">=0 AND ("multiplo" IS NULL OR "multiplo">0) AND ("precio" IS NULL OR "precio">0) AND ("reposicionDias" IS NULL OR "reposicionDias" BETWEEN 0 AND 3650));
ALTER TABLE "OrdenCompra" ADD CONSTRAINT "OrdenCompra_estado_check" CHECK ("estado" IN ('BORRADOR','EMITIDA','PARCIAL','RECIBIDA','CERRADA','CANCELADA') AND "tipoCambio">0);
ALTER TABLE "LineaOrdenCompra" ADD CONSTRAINT "LineaOrdenCompra_cantidades_check" CHECK ("cantidad">0 AND "recibida">=0 AND "recibida"<="cantidad" AND "factorStock">0 AND "precio">0);
ALTER TABLE "CoberturaCompra" ADD CONSTRAINT "CoberturaCompra_cantidades_check" CHECK ("cantidad">0 AND "recibida">=0 AND "recibida"<="cantidad");
ALTER TABLE "DetalleRecepcionCompra" ADD CONSTRAINT "DetalleRecepcionCompra_cantidades_check" CHECK ("cantidadCompra">0 AND "cantidadStock">0 AND "costoStock">0);
