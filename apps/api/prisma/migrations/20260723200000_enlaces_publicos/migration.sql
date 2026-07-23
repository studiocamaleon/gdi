-- Tabla única de credenciales de links públicos.
-- Ver docs/enlaces-publicos-diseno.md

-- CreateEnum
CREATE TYPE "TipoEnlacePublico" AS ENUM ('SEGUIMIENTO_OT', 'PRESUPUESTO', 'FACTURA', 'REMITO', 'COBRO', 'ENCUESTA');

-- CreateTable
CREATE TABLE "EnlacePublico" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "tipo" "TipoEnlacePublico" NOT NULL,
    "entidadId" UUID NOT NULL,
    "expiraEl" TIMESTAMP(3),
    "revocadoEl" TIMESTAMP(3),
    "visitas" INTEGER NOT NULL DEFAULT 0,
    "primeraVistaEl" TIMESTAMP(3),
    "ultimaVistaEl" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnlacePublico_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EnlacePublico_token_key" ON "EnlacePublico"("token");

-- CreateIndex
CREATE UNIQUE INDEX "EnlacePublico_tipo_entidadId_key" ON "EnlacePublico"("tipo", "entidadId");

-- CreateIndex
CREATE INDEX "EnlacePublico_tenantId_tipo_idx" ON "EnlacePublico"("tenantId", "tipo");

-- AddForeignKey
ALTER TABLE "EnlacePublico" ADD CONSTRAINT "EnlacePublico_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: los tokens ya emitidos (22 chars) pasan a ser filas de la tabla.
-- Sin esto, todo link que la imprenta ya mandó por WhatsApp deja de resolver.
INSERT INTO "EnlacePublico" ("id", "tenantId", "token", "tipo", "entidadId", "createdAt")
SELECT gen_random_uuid(), "tenantId", "publicToken", 'SEGUIMIENTO_OT', "id", "createdAt"
FROM "OrdenTrabajo"
WHERE "publicToken" IS NOT NULL;

-- El presupuesto ya registraba su primera apertura: se conserva la métrica.
INSERT INTO "EnlacePublico" ("id", "tenantId", "token", "tipo", "entidadId", "primeraVistaEl", "createdAt")
SELECT gen_random_uuid(), "tenantId", "publicToken", 'PRESUPUESTO', "id", "primeraVistaEl", "createdAt"
FROM "Cotizacion"
WHERE "publicToken" IS NOT NULL;
