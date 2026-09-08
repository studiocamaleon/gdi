CREATE TABLE "GeometriaProducto" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "productoId" UUID NOT NULL,
  "archivoId" UUID NOT NULL,
  "hash" TEXT NOT NULL,
  "interpretacionJson" JSONB NOT NULL,
  "fuenteJson" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GeometriaProducto_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "GeometriaProducto_tenantId_productoId_idx" ON "GeometriaProducto"("tenantId", "productoId");
CREATE INDEX "GeometriaProducto_archivoId_idx" ON "GeometriaProducto"("archivoId");
ALTER TABLE "GeometriaProducto" ADD CONSTRAINT "GeometriaProducto_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GeometriaProducto" ADD CONSTRAINT "GeometriaProducto_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GeometriaProducto" ADD CONSTRAINT "GeometriaProducto_archivoId_fkey" FOREIGN KEY ("archivoId") REFERENCES "Archivo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
