-- Quién le cambió el acceso a quién, dentro de una empresa.
--
-- PlataformaEvento audita al staff de Grafo; esto audita al administrador de la
-- imprenta, que es de quien no había registro. Append-only: sin updatedAt, sin
-- borrado. Los nombres van CONGELADOS (no por FK) para que la línea siga
-- diciendo quién fue aunque la persona se dé de baja.
--
-- Ver docs/usuarios-roles-permisos-diseno.md

CREATE TABLE "EventoAcceso" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "actorUserId" UUID,
    "actorNombre" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "usuarioAfectadoId" UUID,
    "usuarioAfectadoNombre" TEXT,
    "descripcion" TEXT NOT NULL,
    "datosJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventoAcceso_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EventoAcceso_tenantId_createdAt_idx" ON "EventoAcceso"("tenantId", "createdAt");

ALTER TABLE "EventoAcceso" ADD CONSTRAINT "EventoAcceso_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
