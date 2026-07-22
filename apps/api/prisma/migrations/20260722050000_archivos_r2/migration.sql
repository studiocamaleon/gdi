-- CreateEnum
CREATE TYPE "ArchivoScope" AS ENUM ('TENANT_BRANDING', 'CLIENTE', 'ORDEN', 'ORDEN_ITEM', 'COTIZACION', 'COMPROBANTE', 'COBRO', 'PRODUCTO', 'PROVEEDOR');

-- CreateEnum
CREATE TYPE "ArchivoEstado" AS ENUM ('PENDIENTE', 'LISTO', 'ELIMINADO');

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "bytesArchivos" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "cuotaBytesArchivos" BIGINT,
ADD COLUMN     "logoArchivoId" UUID;

-- CreateTable
CREATE TABLE "Archivo" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "scope" "ArchivoScope" NOT NULL,
    "key" TEXT NOT NULL,
    "nombreOriginal" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "bytes" BIGINT NOT NULL DEFAULT 0,
    "hash" TEXT,
    "estado" "ArchivoEstado" NOT NULL DEFAULT 'PENDIENTE',
    "publico" BOOLEAN NOT NULL DEFAULT false,
    "descripcion" TEXT,
    "subidoPorId" UUID,
    "eliminadoEl" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "clienteId" UUID,
    "ordenId" UUID,
    "ordenItemId" UUID,
    "cotizacionId" UUID,
    "comprobanteId" UUID,
    "cobroId" UUID,
    "productoId" UUID,
    "proveedorId" UUID,

    CONSTRAINT "Archivo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Archivo_key_key" ON "Archivo"("key");

-- CreateIndex
CREATE INDEX "Archivo_tenantId_scope_estado_idx" ON "Archivo"("tenantId", "scope", "estado");

-- CreateIndex
CREATE INDEX "Archivo_tenantId_ordenItemId_idx" ON "Archivo"("tenantId", "ordenItemId");

-- CreateIndex
CREATE INDEX "Archivo_tenantId_ordenId_idx" ON "Archivo"("tenantId", "ordenId");

-- CreateIndex
CREATE INDEX "Archivo_tenantId_clienteId_idx" ON "Archivo"("tenantId", "clienteId");

-- CreateIndex
CREATE INDEX "Archivo_tenantId_cotizacionId_idx" ON "Archivo"("tenantId", "cotizacionId");

-- CreateIndex
CREATE INDEX "Archivo_estado_createdAt_idx" ON "Archivo"("estado", "createdAt");

-- AddForeignKey
ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_logoArchivoId_fkey" FOREIGN KEY ("logoArchivoId") REFERENCES "Archivo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Archivo" ADD CONSTRAINT "Archivo_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Archivo" ADD CONSTRAINT "Archivo_subidoPorId_fkey" FOREIGN KEY ("subidoPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Archivo" ADD CONSTRAINT "Archivo_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Archivo" ADD CONSTRAINT "Archivo_ordenId_fkey" FOREIGN KEY ("ordenId") REFERENCES "OrdenTrabajo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Archivo" ADD CONSTRAINT "Archivo_ordenItemId_fkey" FOREIGN KEY ("ordenItemId") REFERENCES "OrdenTrabajoItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Archivo" ADD CONSTRAINT "Archivo_cotizacionId_fkey" FOREIGN KEY ("cotizacionId") REFERENCES "Cotizacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Archivo" ADD CONSTRAINT "Archivo_comprobanteId_fkey" FOREIGN KEY ("comprobanteId") REFERENCES "Comprobante"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Archivo" ADD CONSTRAINT "Archivo_cobroId_fkey" FOREIGN KEY ("cobroId") REFERENCES "Cobro"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Archivo" ADD CONSTRAINT "Archivo_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Archivo" ADD CONSTRAINT "Archivo_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "Proveedor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- El `scope` manda: la FK que le corresponde tiene que estar seteada y las de
-- los otros scopes tienen que estar nulas. TENANT_BRANDING no cuelga de nada.
-- Prisma no puede expresar esto, así que va a mano. Sin el CHECK, un bug de
-- servicio deja archivos "adjuntos" a nada o colgados de la entidad
-- equivocada, y el listado por entidad los perdería en silencio.
--
-- Única excepción: `cotizacionId` sobrevive al pasar a ORDEN_ITEM. Cuando el
-- presupuesto se convierte en OT, el arte se re-vincula al item (gana
-- ordenItemId) pero conserva de dónde vino — no se copian bytes ni se pierde
-- la traza. Ver docs/archivos-r2-diseno.md §4.
ALTER TABLE "Archivo" ADD CONSTRAINT "Archivo_scope_fk_coherente" CHECK (
      (("scope" = 'CLIENTE')     = ("clienteId"     IS NOT NULL))
  AND (("scope" = 'ORDEN')       = ("ordenId"       IS NOT NULL))
  AND (("scope" = 'ORDEN_ITEM')  = ("ordenItemId"   IS NOT NULL))
  AND (("scope" = 'COMPROBANTE') = ("comprobanteId" IS NOT NULL))
  AND (("scope" = 'COBRO')       = ("cobroId"       IS NOT NULL))
  AND (("scope" = 'PRODUCTO')    = ("productoId"    IS NOT NULL))
  AND (("scope" = 'PROVEEDOR')   = ("proveedorId"   IS NOT NULL))
  AND ("cotizacionId" IS NULL OR "scope" IN ('COTIZACION', 'ORDEN_ITEM'))
  AND ("scope" <> 'COTIZACION' OR "cotizacionId" IS NOT NULL)
);

