CREATE TABLE "NestingGuardado" (
  "tenantId" UUID NOT NULL,
  "clave" VARCHAR(64) NOT NULL,
  "resultadoJson" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NestingGuardado_pkey" PRIMARY KEY ("tenantId", "clave"),
  CONSTRAINT "NestingGuardado_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "PreparacionNestingProducto" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "productoId" UUID NOT NULL,
  "rutaClave" VARCHAR(50) NOT NULL,
  "cantidad" INTEGER NOT NULL,
  "estado" VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
  "jobId" TEXT,
  "error" TEXT,
  "duracionMs" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PreparacionNestingProducto_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PreparacionNestingProducto_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PreparacionNestingProducto_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PreparacionNestingProducto_tenantId_productoId_rutaClave_cant_key" ON "PreparacionNestingProducto"("tenantId", "productoId", "rutaClave", "cantidad");
CREATE INDEX "PreparacionNestingProducto_tenantId_productoId_idx" ON "PreparacionNestingProducto"("tenantId", "productoId");
