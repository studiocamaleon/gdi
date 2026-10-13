ALTER TABLE "CentroCopiadoPoliticaBorrador"
 ADD COLUMN "activaRevision" INTEGER,
 ADD COLUMN "activaContenido" JSONB,
 ADD COLUMN "activadaPorId" UUID,
 ADD COLUMN "activadaEl" TIMESTAMP(3);
CREATE TABLE "CentroCopiadoPedidoCalculo" (
 "id" UUID NOT NULL, "tenantId" UUID NOT NULL, "cotizacionId" UUID NOT NULL,
 "clienteId" UUID, "canalVenta" TEXT NOT NULL, "tratamientoFiscal" TEXT NOT NULL,
 "referenciaJson" JSONB NOT NULL, "resultadoJson" JSONB NOT NULL,
 "huella" VARCHAR(64) NOT NULL, "autorizadoPorId" UUID,
 "autorizadoNombre" TEXT, "autorizacionMotivo" VARCHAR(1000),
 "autorizadoEl" TIMESTAMP(3), "creadoPorId" UUID NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "CentroCopiadoPedidoCalculo_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "CentroCopiadoPedidoCalculo_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "CentroCopiadoPedidoCalculo_tenantId_cotizacionId_idx"
 ON "CentroCopiadoPedidoCalculo"("tenantId", "cotizacionId");
