ALTER TYPE "TipoEnlacePublico" ADD VALUE 'ALTA_CLIENTE';
CREATE TABLE "SolicitudAltaCliente" (
 "id" UUID NOT NULL, "tenantId" UUID NOT NULL,
 "nombre" VARCHAR(160) NOT NULL, "documentoTipo" VARCHAR(4) NOT NULL,
 "documentoNumero" VARCHAR(11) NOT NULL, "condicionFiscal" VARCHAR(30) NOT NULL,
 "telefono" VARCHAR(20) NOT NULL, "direccion" VARCHAR(200) NOT NULL, "ciudad" VARCHAR(120) NOT NULL,
 "estado" VARCHAR(12) NOT NULL DEFAULT 'PENDIENTE', "clienteId" UUID,
 "resueltoPorId" UUID, "resueltoPorNombre" TEXT, "resueltoEl" TIMESTAMP(3), "motivo" VARCHAR(500),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "SolicitudAltaCliente_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "SolicitudAltaCliente_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "SolicitudAltaCliente_estado_check" CHECK ("estado" IN ('PENDIENTE','APROBADA','RECHAZADA','VINCULADA'))
);
CREATE INDEX "SolicitudAltaCliente_tenantId_estado_createdAt_idx" ON "SolicitudAltaCliente"("tenantId","estado","createdAt");
CREATE INDEX "SolicitudAltaCliente_tenantId_documentoTipo_documentoNumero_idx" ON "SolicitudAltaCliente"("tenantId","documentoTipo","documentoNumero");
CREATE UNIQUE INDEX "SolicitudAltaCliente_documento_pendiente_key" ON "SolicitudAltaCliente"("tenantId","documentoTipo","documentoNumero") WHERE "estado" = 'PENDIENTE';
UPDATE "Rol" SET "permisos" = array_append("permisos", 'crm.aprobar_altas')
 WHERE "esDelSistema" AND "codigo" = 'administrador' AND NOT ('crm.aprobar_altas' = ANY("permisos"));
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'grafo_app') THEN
  GRANT SELECT, INSERT, UPDATE, DELETE ON "SolicitudAltaCliente" TO grafo_app;
 END IF;
END $$;
