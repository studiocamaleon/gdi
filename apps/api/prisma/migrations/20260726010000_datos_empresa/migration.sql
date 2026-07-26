-- Datos comerciales de la imprenta: teléfono, web, dónde queda, link de reseñas.
-- Aparte de ConfiguracionFiscal a propósito (dos públicos, dos permisos).
-- Ver docs/datos-de-empresa-diseno.md
CREATE TABLE "DatosEmpresa" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "telefonoCodigo" TEXT,
    "telefonoNumero" TEXT,
    "paisCodigo" VARCHAR(2),
    "whatsappCodigo" TEXT,
    "whatsappNumero" TEXT,
    "email" TEXT,
    "sitioWeb" TEXT,
    "domicilioComercial" TEXT,
    "localidad" TEXT,
    "provincia" TEXT,
    "horarioAtencion" TEXT,
    "urlResenas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DatosEmpresa_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DatosEmpresa_tenantId_key" ON "DatosEmpresa"("tenantId");

ALTER TABLE "DatosEmpresa" ADD CONSTRAINT "DatosEmpresa_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
