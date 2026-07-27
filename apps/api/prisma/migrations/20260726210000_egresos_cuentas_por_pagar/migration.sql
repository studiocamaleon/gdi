-- Egresos y Cuentas por pagar (F1).
--
-- Hasta acá el sistema sabía cobrar pero no pagar: no existía ningún documento
-- de compra, `Proveedor` no tenía ni CUIT, y el único movimiento de SALIDA que
-- alguien escribía era la transferencia entre cuentas propias.
--
-- Dos entidades y no una: `Egreso` es la obligación (o el gasto de contado) y
-- `Pago` es el acto de pagar, con imputación N:M entre ellos. Hacen falta las
-- dos porque un pago cubre VARIAS facturas, puede ser parcial, y las
-- retenciones se practican al pagar y no cuando nace el gasto. La UI las
-- colapsa en un solo gesto cuando coinciden, que es el caso más común.
--
-- "Cuentas por pagar" NO es una tabla: es el filtro de los egresos con
-- vencimiento y estado pendiente/parcial.
--
-- Ver docs/egresos-y-cuentas-por-pagar-diseno.md

-- CreateEnum
CREATE TYPE "NaturalezaEgreso" AS ENUM ('COSTO_PRODUCCION', 'GASTO_ESTRUCTURA', 'INVERSION', 'RETIRO_SOCIOS', 'NO_RESULTADO');

-- AlterTable
ALTER TABLE "MovimientoFondos" ADD COLUMN     "pagoId" UUID;

-- AlterTable
ALTER TABLE "Proveedor" ADD COLUMN     "cbuAlias" TEXT,
ADD COLUMN     "condicionIva" TEXT,
ADD COLUMN     "condicionPagoDias" INTEGER,
ADD COLUMN     "cuit" VARCHAR(11);

-- CreateTable
CREATE TABLE "CategoriaEgreso" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "naturaleza" "NaturalezaEgreso" NOT NULL,
    "padreId" UUID,
    "esSistema" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CategoriaEgreso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Egreso" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "numero" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "categoriaEgresoId" UUID NOT NULL,
    "proveedorId" UUID,
    "beneficiarioNombre" TEXT NOT NULL,
    "fechaCompetencia" DATE NOT NULL,
    "fechaVencimiento" DATE,
    "moneda" VARCHAR(3) NOT NULL DEFAULT 'ARS',
    "neto" DECIMAL(14,2) NOT NULL,
    "iva" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "otrosImpuestos" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2) NOT NULL,
    "pagadoTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "tipoComprobante" TEXT,
    "puntoVenta" TEXT,
    "numeroComprobante" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'pendiente',
    "origen" TEXT NOT NULL DEFAULT 'manual',
    "centroCostoId" UUID,
    "gastoFijoEstructuraId" UUID,
    "empleadoId" UUID,
    "anuladoEl" TIMESTAMP(3),
    "motivoAnulacion" TEXT,
    "registradoPorNombre" TEXT,
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Egreso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pago" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "numero" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "metodoPagoId" UUID NOT NULL,
    "cuentaOrigenId" UUID NOT NULL,
    "montoBruto" DECIMAL(14,2) NOT NULL,
    "retencionesTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "montoNeto" DECIMAL(14,2) NOT NULL,
    "moneda" VARCHAR(3) NOT NULL DEFAULT 'ARS',
    "tipoCambio" DECIMAL(14,4),
    "proveedorId" UUID,
    "referencia" VARCHAR(60),
    "valorId" UUID,
    "anuladoEl" TIMESTAMP(3),
    "motivoAnulacion" TEXT,
    "registradoPorNombre" TEXT,
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pago_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PagoImputacion" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "pagoId" UUID NOT NULL,
    "egresoId" UUID NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PagoImputacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EgresoContador" (
    "tenantId" UUID NOT NULL,
    "anio" INTEGER NOT NULL,
    "ultimo" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "EgresoContador_pkey" PRIMARY KEY ("tenantId","anio")
);

-- CreateTable
CREATE TABLE "PagoContador" (
    "tenantId" UUID NOT NULL,
    "anio" INTEGER NOT NULL,
    "ultimo" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PagoContador_pkey" PRIMARY KEY ("tenantId","anio")
);

-- CreateIndex
CREATE INDEX "CategoriaEgreso_tenantId_activo_idx" ON "CategoriaEgreso"("tenantId", "activo");

-- CreateIndex
CREATE UNIQUE INDEX "CategoriaEgreso_tenantId_codigo_key" ON "CategoriaEgreso"("tenantId", "codigo");

-- CreateIndex
CREATE INDEX "Egreso_tenantId_estado_idx" ON "Egreso"("tenantId", "estado");

-- CreateIndex
CREATE INDEX "Egreso_tenantId_fechaVencimiento_idx" ON "Egreso"("tenantId", "fechaVencimiento");

-- CreateIndex
CREATE INDEX "Egreso_tenantId_fechaCompetencia_idx" ON "Egreso"("tenantId", "fechaCompetencia");

-- CreateIndex
CREATE INDEX "Egreso_tenantId_proveedorId_idx" ON "Egreso"("tenantId", "proveedorId");

-- CreateIndex
CREATE INDEX "Egreso_tenantId_categoriaEgresoId_idx" ON "Egreso"("tenantId", "categoriaEgresoId");

-- CreateIndex
CREATE UNIQUE INDEX "Egreso_tenantId_numero_key" ON "Egreso"("tenantId", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "Egreso_tenantId_proveedorId_tipoComprobante_puntoVenta_nume_key" ON "Egreso"("tenantId", "proveedorId", "tipoComprobante", "puntoVenta", "numeroComprobante");

-- CreateIndex
CREATE INDEX "Pago_tenantId_fecha_idx" ON "Pago"("tenantId", "fecha");

-- CreateIndex
CREATE INDEX "Pago_tenantId_proveedorId_idx" ON "Pago"("tenantId", "proveedorId");

-- CreateIndex
CREATE UNIQUE INDEX "Pago_tenantId_numero_key" ON "Pago"("tenantId", "numero");

-- CreateIndex
CREATE INDEX "PagoImputacion_tenantId_egresoId_idx" ON "PagoImputacion"("tenantId", "egresoId");

-- CreateIndex
CREATE UNIQUE INDEX "PagoImputacion_pagoId_egresoId_key" ON "PagoImputacion"("pagoId", "egresoId");

-- AddForeignKey
ALTER TABLE "MovimientoFondos" ADD CONSTRAINT "MovimientoFondos_pagoId_fkey" FOREIGN KEY ("pagoId") REFERENCES "Pago"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoriaEgreso" ADD CONSTRAINT "CategoriaEgreso_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoriaEgreso" ADD CONSTRAINT "CategoriaEgreso_padreId_fkey" FOREIGN KEY ("padreId") REFERENCES "CategoriaEgreso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Egreso" ADD CONSTRAINT "Egreso_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Egreso" ADD CONSTRAINT "Egreso_categoriaEgresoId_fkey" FOREIGN KEY ("categoriaEgresoId") REFERENCES "CategoriaEgreso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Egreso" ADD CONSTRAINT "Egreso_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "Proveedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Egreso" ADD CONSTRAINT "Egreso_centroCostoId_fkey" FOREIGN KEY ("centroCostoId") REFERENCES "CentroCosto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Egreso" ADD CONSTRAINT "Egreso_gastoFijoEstructuraId_fkey" FOREIGN KEY ("gastoFijoEstructuraId") REFERENCES "GastoFijoEstructura"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Egreso" ADD CONSTRAINT "Egreso_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "Empleado"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_metodoPagoId_fkey" FOREIGN KEY ("metodoPagoId") REFERENCES "MetodoPago"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_cuentaOrigenId_fkey" FOREIGN KEY ("cuentaOrigenId") REFERENCES "CuentaFondos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "Proveedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_valorId_fkey" FOREIGN KEY ("valorId") REFERENCES "Valor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PagoImputacion" ADD CONSTRAINT "PagoImputacion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PagoImputacion" ADD CONSTRAINT "PagoImputacion_pagoId_fkey" FOREIGN KEY ("pagoId") REFERENCES "Pago"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PagoImputacion" ADD CONSTRAINT "PagoImputacion_egresoId_fkey" FOREIGN KEY ("egresoId") REFERENCES "Egreso"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EgresoContador" ADD CONSTRAINT "EgresoContador_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PagoContador" ADD CONSTRAINT "PagoContador_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

