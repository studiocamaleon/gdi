-- Egresos F3: gastos recurrentes.
--
-- Una plantilla que emite egresos sola, mes a mes: el alquiler, la luz, el
-- contador. El `monto` es una SUGERENCIA y no una verdad —la luz no viene
-- igual dos meses seguidos—: el egreso nace pendiente con ese importe y quien
-- lo paga lo corrige.
--
-- El único (gastoRecurrenteId, periodoRecurrente) es la idempotencia DURA de
-- la generación: una plantilla emite un solo egreso por período. Sin él, dos
-- instancias del cron corriendo a la vez —o un simple reintento— duplicarían
-- el alquiler del mes, y un pasivo duplicado es de los errores más caros que
-- puede cometer este módulo.
--
-- `gastoFijoEstructuraId` es el puente con el PRESUPUESTADO: permite comparar
-- lo que el costeo planifica por mes contra lo que realmente se pagó, que es
-- el mismo patrón "cotizado vs. real" que ya usamos en las órdenes.
--
-- Ver docs/egresos-y-cuentas-por-pagar-diseno.md §4.5

-- AlterTable
ALTER TABLE "Egreso" ADD COLUMN     "gastoRecurrenteId" UUID,
ADD COLUMN     "periodoRecurrente" TEXT;

-- CreateTable
CREATE TABLE "GastoRecurrente" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "descripcion" TEXT NOT NULL,
    "categoriaEgresoId" UUID NOT NULL,
    "proveedorId" UUID,
    "monto" DECIMAL(14,2) NOT NULL,
    "moneda" VARCHAR(3) NOT NULL DEFAULT 'ARS',
    "metodoPagoId" UUID,
    "frecuencia" TEXT NOT NULL DEFAULT 'mensual',
    "diaVencimiento" INTEGER NOT NULL DEFAULT 10,
    "vigenteDesde" TEXT NOT NULL,
    "vigenteHasta" TEXT,
    "gastoFijoEstructuraId" UUID,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "ultimoPeriodoGenerado" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GastoRecurrente_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GastoRecurrente_tenantId_activo_idx" ON "GastoRecurrente"("tenantId", "activo");

-- CreateIndex
CREATE UNIQUE INDEX "Egreso_gastoRecurrenteId_periodoRecurrente_key" ON "Egreso"("gastoRecurrenteId", "periodoRecurrente");

-- AddForeignKey
ALTER TABLE "Egreso" ADD CONSTRAINT "Egreso_gastoRecurrenteId_fkey" FOREIGN KEY ("gastoRecurrenteId") REFERENCES "GastoRecurrente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GastoRecurrente" ADD CONSTRAINT "GastoRecurrente_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GastoRecurrente" ADD CONSTRAINT "GastoRecurrente_categoriaEgresoId_fkey" FOREIGN KEY ("categoriaEgresoId") REFERENCES "CategoriaEgreso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GastoRecurrente" ADD CONSTRAINT "GastoRecurrente_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "Proveedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GastoRecurrente" ADD CONSTRAINT "GastoRecurrente_metodoPagoId_fkey" FOREIGN KEY ("metodoPagoId") REFERENCES "MetodoPago"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GastoRecurrente" ADD CONSTRAINT "GastoRecurrente_gastoFijoEstructuraId_fkey" FOREIGN KEY ("gastoFijoEstructuraId") REFERENCES "GastoFijoEstructura"("id") ON DELETE SET NULL ON UPDATE CASCADE;

